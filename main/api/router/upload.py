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
        self._parsed = False

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
        if self._parsed:
            return

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

        self.absensies_obj = []
        lock_filter_query = None
        absensi_filter_query = None

        for d in datas:
            payload = json.loads(d.data)
            date_str = payload["date"]

            try:
                date = self.parse_date(date_str)
            except ValueError:
                continue

            if d.action == "absen":
                siswa_id = payload["siswa"]
                siswa = siswas.get(siswa_id)

                if not siswa:
                    continue

                absensi_obj = AbsensiClass(
                    date=date, siswa=siswa, payload=payload, action=d.action
                )
                self.absensies_obj.append(absensi_obj)

                q = Q(siswa__kelas__pk=siswa.kelas.pk) & Q(date=date)
                if absensi_filter_query is None:
                    absensi_filter_query = q
                else:
                    absensi_filter_query |= q

                lq = Q(kelas__pk=siswa.kelas.pk) & Q(date=date)
                if lock_filter_query is None:
                    lock_filter_query = lq
                else:
                    lock_filter_query |= lq

            elif d.action in ("lock", "unlock"):
                kelas_id = payload["kelas"]
                absensi_obj = AbsensiClass(
                    date=date, siswa=None, payload=payload, action=d.action
                )
                self.absensies_obj.append(absensi_obj)

                lq = Q(kelas__pk=kelas_id) & Q(date=date)
                if lock_filter_query is None:
                    lock_filter_query = lq
                else:
                    lock_filter_query |= lq

        if lock_filter_query:
            for lock in KunciAbsensi.objects.filter(lock_filter_query):
                date_string = lock.date.strftime("%d-%m-%Y")
                key = f"{date_string}_{lock.kelas_id}"
                self.locks[key] = lock.locked

        if absensi_filter_query:
            for absensi in Absensi.objects.filter(absensi_filter_query):
                date_string = absensi.date.strftime("%d-%m-%Y")
                key = f"{date_string}_{absensi.siswa_id}"
                self.absensies[key] = absensi

        self._parsed = True

    def get_absensies(self) -> List[AbsensiClass]:
        self._parse_data()
        return self.absensies_obj

    def is_absensi_locked(self, date, kelas_id):
        date_string = date.date().strftime("%d-%m-%Y") if isinstance(date, datetime) else date.strftime("%d-%m-%Y")
        return self.locks.get(f"{date_string}_{kelas_id}", False)

    def get_absensi(self, date, siswa_id):
        date_string = date.date().strftime("%d-%m-%Y") if isinstance(date, datetime) else date.strftime("%d-%m-%Y")
        return self.absensies.get(f"{date_string}_{siswa_id}")

    def handle(self):
        user = self.request.auth

        try:
            absensies = self.get_absensies()
        except ValueError as e:
            return 400, {"detail": str(e)}

        conflicts = []

        for absensi_data in absensies:
            payload = absensi_data.payload
            date = absensi_data.date

            if absensi_data.action == "absen":
                siswa = absensi_data.siswa

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

                is_locked = self.is_absensi_locked(date, siswa.kelas_id)
                if is_locked:
                    transaction.set_rollback(True)
                    return 403, {
                        "detail": f"Tidak bisa melanjutkan aksi. Absen tanggal {date} sedang dikunci, coba hubungi wali kelas atau operator"
                    }

                updated_at_int = int(payload.get("updated_at", time.time()))
                updated_at = datetime.fromtimestamp(updated_at_int).astimezone(
                    settings.TIME_ZONE_OBJ
                )

                absensi = self.get_absensi(date, siswa.pk)

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

            elif absensi_data.action in ("lock", "unlock"):
                if user.type != User.TypeChoices.WALI_KELAS:
                    transaction.set_rollback(True)
                    return 403, {"detail": "Ditolak"}

                kelas_id = payload["kelas"]
                is_kelas_owner = Kelas.objects.own(user.pk).filter(pk=kelas_id).exists()
                if not is_kelas_owner:
                    transaction.set_rollback(True)
                    return 403, {"detail": "Ditolak"}

                locked = absensi_data.action == "lock"

                KunciAbsensi.objects.update_or_create(
                    date=date,
                    kelas__pk=kelas_id,
                    defaults={"locked": locked, "date": date, "kelas_id": kelas_id},
                )

        return {"data": {"conflicts": conflicts}}


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
