from datetime import datetime, timedelta
from typing import Optional

from django.db.models import Prefetch
from django.utils import timezone

from main.api.api import api
from main.api.core.types import HttpRequest
from main.models import AbsensiSession, Kelas

from ..schemas import ErrorSchema, SuccessSchema


def _format_time(value) -> Optional[str]:
    """Format object waktu (time/datetime/str) -> 'HH:MM' atau None."""
    if value is None:
        return None
    if hasattr(value, "strftime"):
        return value.strftime("%H:%M")
    
    # fallback to str
    return str(value)

def _jam_masuk_sampai(session: AbsensiSession) -> Optional[str]:
    """
    Hitung jam_masuk + toleransi.
    jam_masuk : time
    jam_masuk_toleransi : timedelta (diutamakan) atau time (fallback)
    """
    if not getattr(session, "jam_masuk", None):
        return None

    today = timezone.localdate()
    jam_masuk_dt = datetime.combine(today, session.jam_masuk)

    tol = getattr(session, "jam_masuk_toleransi", None) or timedelta(0)

    # toleransi mungkin disimpan sebagai timedelta atau time; tangani kedua kasus
    if isinstance(tol, timedelta):
        jam_sampai_dt = jam_masuk_dt + tol
    else:
        # jika tol berupa time -> konversi ke timedelta
        try:
            tol_td = timedelta(hours=tol.hour, minutes=tol.minute, seconds=tol.second)
            jam_sampai_dt = jam_masuk_dt + tol_td
        except Exception:
            # fallback: anggap tidak ada toleransi
            jam_sampai_dt = jam_masuk_dt

    return jam_sampai_dt.time().strftime("%H:%M")


@api.get("/jadwal", response={403: ErrorSchema, 200: SuccessSchema})
def get_jadwal_absensi(request: HttpRequest):
    if request.auth.type != "guru_piket":
        return 403, {"detail": "Forbidden"}

    days = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu"]

    pref = Prefetch("jadwal_kelas", queryset=AbsensiSession.objects.all(), to_attr="prefetched_jadwal")
    kelass = Kelas.objects.only_active().prefetch_related(pref)

    results = {}

    for kelas in kelass:
        results[kelas.pk] = {"name": kelas.name}

        # buat dict default None untuk tiap hari
        for day in days:
            results[kelas.pk][day] = None

        # prefetched_jadwal berisi semua AbsensiSession untuk kelas ini
        prefetched = getattr(kelas, "prefetched_jadwal", None)
        if prefetched is None:
            # fallback ke related manager (jika prefetch gagal)
            prefetched = list(kelas.jadwal_kelas.all())

        # untuk tiap hari, cari sesi pertama yang memiliki flag day=True
        for day in days:
            session = next((s for s in prefetched if getattr(s, day, False)), None)
            if not session:
                continue

            results[kelas.pk][day] = {
                "jam_masuk": _format_time(session.jam_masuk),
                "jam_masuk_sampai": _jam_masuk_sampai(session),
                # jam_keluar bisa bernama safe_jam_keluar / jam_keluar_mulai_absen pada model:
                # utamakan safe_jam_keluar kalau ada, fallback ke jam_keluar_mulai_absen
                "jam_keluar": _format_time(getattr(session, "safe_jam_keluar", None) or getattr(session, "jam_keluar_mulai_absen", None)),
            }

    return {"data": results}

