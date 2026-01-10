import json
import re
import time
from datetime import datetime

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


@api.post("/upload", response={403: ErrorSchema, 400: ErrorSchema, 200: SuccessSchema})
@transaction.atomic
def upload(request: HttpRequest, data: DataUploadSchema):
    # TODO: terlalu spageti, ubah ke class based view
    user = request.auth

    conflicts = []

    # urutan: unlock, absen, lock
    # tujuannya agar absen tidak terkunci
    datas = sorted(
        data.data,
        key=lambda x: 0 if x.action == "unlock" else 1 if x.action == "absen" else 2,
    )

    ddmmyy_pattern = re.compile(
        r"^\b(0?[1-9]|[12][0-9]|3[01])-(0?[1-9]|1[0-2])-\d{2}\b$"
    )

    siswa_ids_query = None
    for absen_data in filter(lambda d: d.action == "absen", datas):
        payload = json.loads(absen_data.data)
        siswa_id = payload["siswa"]

        if siswa_ids_query is None:
            siswa_ids_query = Q(pk=siswa_id)
        else:
            siswa_ids_query |= Q(pk=siswa_id)

    siswas = {}
    for s in Siswa.objects.filter(siswa_ids_query).select_related("kelas"):
        siswas[s.pk] = s

    for data in datas:
        payload = json.loads(data.data)

        if re.match(ddmmyy_pattern, payload["date"]):
            dd, mm, yy = payload["date"].split("-")
            date = datetime(
                year=2000 + int(yy),
                month=int(mm),
                day=int(dd),
            )

        else:
            try:
                date = dateutil_parser.parse(payload["date"])
            except dateutil_parser._parser.ParserError:
                transaction.set_rollback(True)
                return 400, {"detail": "gagal parsing tanggal %s" % payload["date"]}

        # tanggal harus dalam rentang 1 Januari 2020 - hari diabsen
        date_is_invalid = (date.date() > timezone.now().date()) or (
            date.date().year < 2020
        )
        if date_is_invalid:
            continue

        if data.action == "absen":
            updated_at_int = int(payload.get("updated_at", time.time()))
            updated_at = datetime.fromtimestamp(updated_at_int).astimezone(
                settings.TIME_ZONE_OBJ
            )

            siswa_id = payload["siswa"]
            siswa = siswas.get(siswa_id)

            if not siswa:
                continue

            kelas_sekretaris_ids = siswa.kelas.sekretaris.values_list("id", flat=True)
            if (
                siswa.kelas.wali_kelas_id == user.pk
            ) or user.pk in kelas_sekretaris_ids:
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

        elif data.action in ["lock", "unlock"]:
            if user.type != User.TypeChoices.WALI_KELAS:
                transaction.set_rollback(True)
                return 403, {"detail": "Ditolak"}

            kelas_id = payload["kelas"]
            is_kelas_owner = Kelas.objects.own(user.pk).filter(pk=kelas_id).exists()
            if not is_kelas_owner:
                transaction.set_rollback(True)
                return 403, {"detail": "Ditolak"}

            locked = data.action == "lock"

            KunciAbsensi.objects.update_or_create(
                date=date,
                kelas__pk=kelas_id,
                defaults={"locked": locked, "date": date, "kelas_id": payload["kelas"]},
            )

    return {"data": {"conflicts": conflicts}}


@api.post("/compressed-upload", response={403: ErrorSchema, 200: SuccessSchema})
def compressed_upload(request: HttpRequest, data: DataCompressedUploadSchema):
    lz = LZString()

    data_decompressed_json = lz.decompressFromBase64(data.data)
    data_decompressed = json.loads(data_decompressed_json)

    data_upload = DataUploadSchema(data=data_decompressed)
    return upload(request, data_upload)
