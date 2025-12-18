import json
import re
import time
from datetime import datetime

from dateutil import parser as dateutil_parser
from django.conf import settings
from django.db import transaction
from lzstring import LZString

from main.api.api import api
from main.api.core.types import HttpRequest
from main.models import Absensi, KunciAbsensi, Siswa

from ..schemas import (DataCompressedUploadSchema, DataUploadSchema,
                       ErrorSchema, SuccessSchema)


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

    for x in datas:
        payload = json.loads(x.data)

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

        if x.action == "absen":
            updated_at_int = int(payload.get("updated_at", time.time()))
            updated_at = datetime.fromtimestamp(updated_at_int).astimezone(
                settings.TIME_ZONE_OBJ
            )

            siswa = Siswa.objects.filter(pk=payload["siswa"]).first()
            if not siswa:
                continue

            if (
                siswa.kelas.wali_kelas and siswa.kelas.wali_kelas.pk == user.pk
            ) or siswa.kelas.sekretaris.filter(pk=user.pk).exists():
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

        elif x.action == "lock":
            KunciAbsensi.objects.update_or_create(
                date=date,
                kelas__pk=payload["kelas"],
                defaults={"locked": True, "date": date, "kelas_id": payload["kelas"]},
            )

        elif x.action == "unlock":
            KunciAbsensi.objects.update_or_create(
                date=date,
                kelas__pk=payload["kelas"],
                defaults={"locked": False, "date": date, "kelas_id": payload["kelas"]},
            )

    return {"data": {"conflicts": conflicts}}


@api.post("/compressed-upload", response={403: ErrorSchema, 200: SuccessSchema})
def compressed_upload(request: HttpRequest, data: DataCompressedUploadSchema):
    lz = LZString()

    data_decompressed_json = lz.decompressFromBase64(data.data)
    data_decompressed = json.loads(data_decompressed_json)

    data_upload = DataUploadSchema(data=data_decompressed)
    return upload(request, data_upload)
