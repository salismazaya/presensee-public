import threading
import calendar
import hashlib

from main.api.api import api
from main.api.core.types import HttpRequest
from main.helpers import pdf as helpers_pdf
from main.helpers import redis
from main.helpers.humanize import localize_month_to_string
from main.models import Kelas, Absensi
from datetime import date
from django.core.serializers import serialize
from ..schemas import ErrorSchema, SuccessSchema

REKAP_THREADING_LOCK = threading.Lock()


@api.get(
    "/get-rekap", response={404: ErrorSchema, 500: ErrorSchema, 200: SuccessSchema}
)
def get_rekap(request: HttpRequest, bulan: int, kelas: int, tahun: int):
    kelas_obj = Kelas.objects.filter(pk=kelas).first()

    bulan_str = localize_month_to_string(bulan)

    if not kelas_obj:
        return 404, {"detail": "kelas not found"}

    is_kesiswaan = request.auth.type == "kesiswaan"
    is_wali_kelas = (
        request.auth.type == "wali_kelas" and kelas_obj.wali_kelas.pk == request.auth.pk
    )
    is_sekretaris = (
        request.auth.type == "sekretaris"
        and kelas_obj.sekretaris.filter(pk=request.auth.pk).exists()
    )

    if tahun <= 99:
        tahun += 2000

    can_access = is_kesiswaan or is_wali_kelas or is_sekretaris

    if not can_access:
        return 404, {"detail": "kelas not found"}

    date_start = date(tahun, bulan, 1)
    last_day_of_month = calendar.monthrange(tahun, bulan)[1]
    date_end = date(tahun, bulan, last_day_of_month)

    absensi_hash = Absensi.objects.filter(
        siswa__kelas__pk=kelas, date__gte=date_start, date__lte=date_end
    )
    absensi_hash = serialize('python', absensi_hash)
    absensi_hash = str(absensi_hash).encode()
    absensi_hash = hashlib.md5(absensi_hash).hexdigest()

    file_id = f"rekap-{absensi_hash}"

    # CACHING FILE ID
    with redis.get_client() as redis_client:
        cached_file_id = redis_client.exists(file_id)
        if cached_file_id:
            return {"data": {"file_id": file_id}}

    with REKAP_THREADING_LOCK:  # hanya 1 pembuatan pdf dalam 1 waktu (per worker)
        file = helpers_pdf.generate_pdf(kelas_obj, bulan, tahun)

    filename = "Rekap %s-%s%s.pdf" % (kelas_obj.name, bulan_str, tahun)
    filename = filename.replace(" ", "-")
    filename_with_padding = filename.encode().ljust(100, b"\r")

    mimetype = "application/pdf"
    mimetype_with_padding = mimetype.encode().ljust(100, b"\r")

    file_with_filename = filename_with_padding + mimetype_with_padding + file

    with redis.get_client() as redis_client:
        # file akan kadaluarsa/terhapus dalam 24 jam
        redis_client.set(file_id, file_with_filename, ex=3600 * 24)

    return {"data": {"file_id": file_id}}
