from datetime import datetime

from main.api.api import api
from main.api.core.types import HttpRequest
from main.models import AbsensiSession, Kelas

from ..schemas import ErrorSchema, SuccessSchema


@api.get("/jadwal", response={403: ErrorSchema, 200: SuccessSchema})
def get_jadwal_absensi(request: HttpRequest):
    if request.auth.type != "guru_piket":
        return 403, {"detail": "Forbidden"}

    results = {}
    kelass: list[Kelas] = Kelas.objects.all()

    for kelas in kelass:
        results[kelas.pk] = {
            "name": kelas.name,
        }

        for day in ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu"]:
            # TODO: N+1 issue. sementara aman aja karena ada cache
            absensi_session: AbsensiSession = kelas.jadwal_kelas.filter(
                **{day: True}
            ).first()
            if absensi_session:
                # results[kelas.pk][day] = (
                #     absensi_session.jam_masuk.strftime('%H:%M'),
                #     absensi_session.safe_jam_keluar.strftime('%H:%M')
                # )
                jam_masuk_sampai = datetime.now().date()
                jam_masuk_sampai = datetime.combine(
                    jam_masuk_sampai, absensi_session.jam_masuk
                )
                jam_masuk_sampai = (
                    jam_masuk_sampai + absensi_session.jam_masuk_toleransi
                )
                jam_masuk_sampai = jam_masuk_sampai.time()

                results[kelas.pk][day] = {
                    "jam_masuk": absensi_session.jam_masuk.strftime("%H:%M"),
                    "jam_masuk_sampai": jam_masuk_sampai.strftime("%H:%M"),
                    "jam_keluar": absensi_session.jam_keluar_mulai_absen,
                }
            else:
                results[kelas.pk][day] = None

    return {"data": results}
