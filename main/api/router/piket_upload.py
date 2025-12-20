import pickle
from datetime import datetime

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from main.api.api import api
from main.api.core.types import HttpRequest
from main.helpers import redis
from main.models import Absensi, AbsensiSession, Siswa

from ..schemas import ErrorSchema, PiketDataUploadSchema, SuccessSchema


@api.post("/piket/upload", response={403: ErrorSchema, 200: SuccessSchema})
def piket_upload(request: HttpRequest, data: list[PiketDataUploadSchema]):
    absensies = data
    invalids = []

    redis_client = redis.get_singleton_client()
    current_domain = request.META["HTTP_HOST"]
    waiting_data_key = f"piket_waiting_to_upload_{current_domain}"

    waiting_data = redis_client.get(waiting_data_key)
    if waiting_data is None:
        waiting_data = []
    else:
        waiting_data = pickle.loads(waiting_data)

    absensies.extend(waiting_data)

    # TODO: implementasi minimal jumlah absensi untuk di-upload.
    # TODO: bertujuan untuk membuat database bekerja dalam mode batch
    # TODO: data sementara di simpan di waiting_data_key

    # sort agar absen type masuk di-proses terlebih dahulu
    absensies.sort(key=lambda x: 0 if x.type == "absen_masuk" else 1)

    new_absensies = []
    updated_absensies = []

    for absensi in absensies:
        date = datetime.fromtimestamp(absensi.timestamp).date()
        absensi_obj: Absensi = (
            Absensi.objects.filter(siswa_id=absensi.siswa).filter(date=date).first()
        )

        match date.strftime("%A"):
            case "Monday":
                nameOfDay = "senin"
            case "Tuesday":
                nameOfDay = "selasa"
            case "Wednesday":
                nameOfDay = "rabu"
            case "Thursday":
                nameOfDay = "kamis"
            case "Friday":
                nameOfDay = "jumat"
            case "Saturday":
                nameOfDay = "sabtu"
            case "Sunday":
                continue

        siswa_obj = Siswa.objects.get(pk=absensi.siswa)

        absensi_session: AbsensiSession = (
            AbsensiSession.objects.filter(kelas__in=[siswa_obj.kelas_id])
            .filter(**{nameOfDay: True})
            .first()
        )

        if absensi_session is None:
            invalids.append(absensi)
            continue

        if absensi.type == "absen_pulang":
            if absensi_obj:
                absensi_obj.status = Absensi.StatusChoices.HADIR
                # absensi_obj.save()
                updated_absensies.append(absensi_obj)
            else:
                invalids.append(absensi)

        elif absensi.type == "absen_masuk" and absensi_obj is None:
            jam_keluar = datetime.combine(
                timezone.now().date(),
                absensi_session.jam_keluar,
                tzinfo=settings.TIME_ZONE_OBJ,
            )

            new_absensi = Absensi(
                date=date,
                siswa_id=absensi.siswa,
                by_id=request.auth.pk,
                wait_expired_at=jam_keluar,
                status=Absensi.StatusChoices.WAIT,
            )
            new_absensies.append(new_absensi)

    # hit db
    with transaction.atomic():
        Absensi.objects.bulk_create(new_absensies)
        Absensi.objects.bulk_update(updated_absensies, fields=["_status"])

    # waiting data akan dihapus jika tidak diproses lebih dari 2 hari
    invalids_pickled = pickle.dumps(invalids)
    redis_client.set(waiting_data_key, invalids_pickled, ex=86400 * 2)

    # invalids berfungsi untuk mengembalikan data yang tidak valid ke client guru piket
    # untuk sementara ini akan konstan return empty array
    return {"data": {"invalids": []}}
