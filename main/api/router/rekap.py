import threading
import uuid

from main.api.api import api
from main.api.core.types import HttpRequest
from main.helpers import pdf as helpers_pdf
from main.helpers import redis
from main.helpers.humanize import localize_month_to_string
from main.models import Kelas

from ..schemas import ErrorSchema, SuccessSchema

REKAP_THREADING_LOCK = threading.Lock()


@api.get(
    "/get-rekap", response={404: ErrorSchema, 500: ErrorSchema, 200: SuccessSchema}
)
def get_rekap(request: HttpRequest, bulan: int, kelas: int, tahun: int):
    cache_key = f"rekap_{bulan}_{tahun}_{kelas}"

    kelas_obj = Kelas.objects.filter_domain(request).filter(pk=kelas).first()

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

    can_access = is_kesiswaan or is_wali_kelas or is_sekretaris

    if not can_access:
        return 404, {"detail": "kelas not found"}

    # CACHING FILE ID
    with redis.get_client() as redis_client:
        cached_file_id = redis_client.get(cache_key)
        if cached_file_id:
            return {"data": {"file_id": cached_file_id.decode()}}

    with REKAP_THREADING_LOCK:  # hanya 1 pembuatan pdf dalam 1 waktu (per worker)
        file = helpers_pdf.generate_pdf(kelas_obj, bulan, tahun)

    filename = "Rekap %s-%s%s.pdf" % (kelas_obj.name, bulan_str, tahun)
    filename = filename.replace(" ", "-")
    filename_with_padding = filename.encode().ljust(100, b"\r")

    mimetype = "application/pdf"
    mimetype_with_padding = mimetype.encode().ljust(100, b"\r")

    file_with_filename = filename_with_padding + mimetype_with_padding + file

    with redis.get_client() as redis_client:
        file_id = str(uuid.uuid4())

        # file akan kadaluarsa/terhapus dalam 24 jam
        redis_client.set(file_id, file_with_filename, ex=3600 * 24)

        # cache file_id agar tidak diproses ulang. cek sekitar line 153
        # cache diatur 6 jam
        redis_client.set(cache_key, file_id, ex=3600 * 6)

    return {"data": {"file_id": file_id}}
