import json
import re
import time
from datetime import datetime
from typing import List
from dataclasses import dataclass

from dateutil import parser as dateutil_parser
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from lzstring import LZString

from main.api.api import api
from main.api.core.types import HttpRequest
from main.models import Absensi, KunciAbsensi, Siswa, Kelas, User

from ..schemas import (
    DataCompressedUploadSchema,
    DataUploadSchema,
    ErrorSchema,
    SuccessSchema,
)


@dataclass
class AbsensiClass:
    siswa: Siswa
    date: datetime
    payload: dict
    action: str


class UploadView:
    def __init__(self, request: HttpRequest, data: DataUploadSchema):
        self.request = request
        self.data = data
        self.locks = {}
        self.absensies = {}
        self.absensies_obj = []

    def get_absensies(self) -> List[AbsensiClass]:
        return self.absensies_obj

    @staticmethod
    def parse_date(date_str: str):
        ddmmyy_pattern = re.compile(
            r"^\b(0?[1-9]|[12][0-9]|3[01])-(0?[1-9]|1[0-2])-\d{2}\b$"
        )

        if re.match(ddmmyy_pattern, date_str):
            dd, mm, yy = date_str.split("-")
            date = datetime(
                year=2000 + int(yy),
                month=int(mm),
                day=int(dd),
            )

        else:
            try:
                date = dateutil_parser.parse(date_str)
            except dateutil_parser._parser.ParserError:
                raise ValueError("date %s invalid" % date_str)

        # tanggal harus dalam rentang 1 Januari 2020 - hari diabsen
        date_is_invalid = (date.date() > timezone.now().date()) or (
            date.date().year < 2020
        )
        if date_is_invalid:
            raise ValueError("date %s invalid" % date_str)

        return date

    def _parse_data(self):
        data = self.data

        # urutan: unlock, absen, lock
        # tujuannya agar absen tidak terkunci
        datas = sorted(
            data.data,
            key=lambda x: (
                0 if x.action == "unlock" else 1 if x.action == "absen" else 2
            ),
        )

        siswa_ids = []
        for absen_data in filter(lambda d: d.action == "absen", datas):
            payload = json.loads(absen_data.data)
            siswa_id = payload["siswa"]
            siswa_ids.append(siswa_id)

        siswas = {}
        for s in Siswa.objects.filter(pk__in=siswa_ids).select_related("kelas"):
            siswas[s.pk] = s

        absensi_filter_query = None

        for data in datas:
            payload = json.loads(data.data)
            date_str = payload["date"]
            date = self.parse_date(date_str)

            siswa_id = payload["siswa"]
            siswa = siswas.get(siswa_id)

            absensi_obj = AbsensiClass(
                date=date, siswa=siswa, payload=payload, action=data.action
            )
            self.absensies_obj.append(absensi_obj)

            if absensi_filter_query is None:
                absensi_filter_query = Q(kelas__pk=siswa.kelas.pk) & Q(date=date)
            else:
                absensi_filter_query |= Q(kelas__pk=siswa.kelas.pk) & Q(date=date)

        for lock in KunciAbsensi.objects.filter(absensi_filter_query):
            date_string = lock.date.strftime("%d-%m-%Y")
            self.locks[f"{date_string}_{lock.kelas_id}"] = True

        for absensi in Absensi.objects.filter(absensi_filter_query):
            date_string = absensi.date.strftime("%d-%m-%Y")
            self.absensies[f"{date_string}_{absensi.kelas_id}"] = absensi

    def is_absensi_locked(self, date, kelas_id):
        if not self.locks:
            self._parse_data()

        date_string = date.strftime("%d-%m-%Y")
        return self.locks.get(f"{date_string}_{kelas_id}") == True  # noqa: E712

    def get_absensi(self, date, kelas_id):
        if not self.absensies:
            self._parse_data()

        date_string = date.strftime("%d-%m-%Y")
        return self.absensies.get(f"{date_string}_{kelas_id}")

    def handle(self):
        try:
            absensies = self.get_absensies()
        except ValueError as e:
            return 400, {"detail": str(e)}

        conflicts = []

        for absensi_data in absensies:
            payload = absensi_data.payload
            is_locked = self.is_absensi_locked(
                absensi_data.date, absensi_data.siswa.kelas_id
            )
            if is_locked:
                return 403, {
                    "detail": f"Tidak bisa melanjutkan aksi. Absen tanggal {absensi_data.date} sedang dikunci, coba hubungi wali kelas atau operator"
                }

            if absensi_data.action == "absen":
                updated_at_int = int(payload.get("updated_at", time.time()))
                updated_at = datetime.fromtimestamp(updated_at_int).astimezone(
                    settings.TIME_ZONE_OBJ
                )

                # siswa_id = payload["siswa"]
                # siswa = siswas.get(siswa_id)
                siswa = self.get_absensi()

                if not siswa:
                    continue

                kelas_sekretaris_ids = siswa.kelas.sekretaris.values_list(
                    "id", flat=True
                )
                can_access = (
                    siswa.kelas.wali_kelas_id == user.pk
                ) or user.pk in kelas_sekretaris_ids

                if not can_access:
                    continue

                lock = (
                    KunciAbsensi.objects.filter(date=date)
                    .filter(kelas__pk=siswa.kelas.pk)
                    .first()
                )

                if lock and lock.locked:
                    transaction.set_rollback(True)
                    return 403, {
                        "detail": f"Tidak bisa melanjutkan aksi. Absen tanggal {date} sedang dikunci, coba hubungi wali kelas atau operator"
                    }

                absensi: Absensi = Absensi.objects.filter(
                    siswa__pk=siswa.pk, date=date
                ).first()

                if absensi is None:
                    Absensi.objects.create(
                        siswa_id=siswa.pk,
                        date=date,
                        status=payload["status"],
                        # karena ini insert berarti updated_at=created_at
                        created_at=updated_at,
                        updated_at=updated_at,
                        by_id=user.pk,
                    )
                elif absensi.by is None:
                    # absensi bukan None karena sudah divalidasi diatas
                    absensi.status = payload["status"]
                    absensi.updated_at = updated_at
                    absensi.by_id = user.pk
                    absensi.save()
                else:
                    current_absensi_status = absensi.status
                    absensi_status = payload["status"]
                    previous_absensi_status = payload.get("previous_status")

                    is_absensi_status_same = current_absensi_status == absensi_status
                    is_user_same = user.pk == absensi.by.pk

                    if not is_absensi_status_same and is_user_same:
                        absensi.status = payload["status"]
                        absensi.updated_at = updated_at
                        absensi.save()

                    elif (
                        not is_absensi_status_same
                        and not is_user_same
                        and previous_absensi_status is None
                    ):
                        conflict = {
                            "type": "absensi",
                            "absensi_id": absensi.pk,
                            "absensi_siswa": absensi.siswa.fullname,
                            "absensi_siswa_id": absensi.siswa.pk,
                            "absensi_kelas_id": absensi.siswa.kelas.pk,
                            "absensi_date": absensi.date,
                            "other": {
                                "display_name": str(absensi.by),
                                "absensi_status": current_absensi_status,
                            },
                            "self": {
                                "display_name": str(user),
                                "absensi_status": absensi_status,
                            },
                        }

                        conflicts.append(conflict)

                    elif (
                        not is_absensi_status_same
                        and not is_user_same
                        and previous_absensi_status
                    ):
                        if (previous_absensi_status == current_absensi_status) or (
                            current_absensi_status == Absensi.StatusChoices.WAIT
                            # jika status absensi adalah wait, berarti diabsen guru piket
                            # jadi boleh ditimpa
                        ):
                            absensi.status = payload["status"]
                            absensi.updated_at = updated_at
                            absensi.by = user
                            absensi.save()
                        else:
                            conflict = {
                                "type": "absensi",
                                "absensi_id": absensi.pk,
                                "absensi_siswa": absensi.siswa.fullname,
                                "absensi_siswa_id": absensi.siswa.pk,
                                "absensi_kelas_id": absensi.siswa.kelas.pk,
                                "absensi_date": absensi.date,
                                "other": {
                                    "display_name": str(absensi.by),
                                    "absensi_status": current_absensi_status,
                                },
                                "self": {
                                    "display_name": str(user),
                                    "absensi_status": absensi_status,
                                },
                            }

                            conflicts.append(conflict)

        return {"data":{"conflicts": conflicts}}

@api.post("/upload", response={403: ErrorSchema, 400: ErrorSchema, 200: SuccessSchema})
@transaction.atomic
def upload(request: HttpRequest, data: DataUploadSchema):
    view = UploadView(request, data)
    rv = view.handle()
    return rv

@api.post("/compressed-upload", response={403: ErrorSchema, 200: SuccessSchema})
def compressed_upload(request: HttpRequest, data: DataCompressedUploadSchema):
    lz = LZString()

    data_decompressed_json = lz.decompressFromBase64(data.data)
    data_decompressed = json.loads(data_decompressed_json)

    data_upload = DataUploadSchema(data=data_decompressed)
    return upload(request, data_upload)
