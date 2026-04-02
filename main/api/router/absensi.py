from dateutil import parser as dateutil_parser

from django.db.models import Count, Q, Subquery, OuterRef

from main.api.api import api
from main.api.core.types import HttpRequest
from main.models import Absensi, Kelas, Siswa

from ..schemas import ErrorSchema, SuccessSchema


@api.get("/absensi", response={404: ErrorSchema, 403: ErrorSchema, 200: SuccessSchema})
def get_absensies(request: HttpRequest, date: str, kelas_id: int):
    try:
        date = dateutil_parser.parse(date).date()
    except dateutil_parser._parser.ParserError:
        return 403, {"detail": "Tanggal tidak valid"}

    kelas = Kelas.objects.own(request.auth.pk).filter(pk=kelas_id).first()

    if kelas is None:
        return 404, {"detail": "kelas tidak ditemukan"}

    result = {}
    siswas = kelas.siswas.annotate(
        absensi_status=Subquery(
            Absensi.objects.filter(date=date, siswa__pk=OuterRef("pk")).values(
                "_status"
            )[:1]
        )
    )

    for siswa in siswas:
        absensi_status = siswa.absensi_status
        if absensi_status:
            result[siswa.pk] = absensi_status
        else:
            result[siswa.pk] = None

    return {"data": result}


@api.get("/absensi/progress", response={400: ErrorSchema, 200: SuccessSchema})
def get_absensi_progress(request: HttpRequest, kelas_id: int, dates: str):
    dates = dates.split(",")

    if len(dates) >= 32:
        return 400, {"detail": "terlalu banyak input tanggal"}

    total_siswa = Siswa.objects.filter(kelas__pk=kelas_id).count()

    result = {}
    queries = {}

    for date in dates:
        try:
            date_obj = dateutil_parser.parse(date)
        except ValueError:
            return 400, {"detail": "gagal parsing %s" % date}

        total_absensi = Count(
            "pk", filter=Q(siswa__kelas__pk=kelas_id) & Q(date=date_obj)
        )

        total_tidak_masuk = Count(
            "pk",
            filter=Q(siswa__kelas__pk=kelas_id)
            & Q(date=date_obj)
            & ~Q(_status=Absensi.StatusChoices.HADIR),
        )

        queries["date_%s_total_absensi" % date] = total_absensi
        queries["date_%s_total_tidak_masuk" % date] = total_tidak_masuk

    query_result = Absensi.objects.aggregate(**queries)

    for date in dates:
        total_absensi = query_result["date_%s_total_absensi" % date]
        total_tidak_masuk = query_result["date_%s_total_tidak_masuk" % date]

        is_complete = total_absensi == total_siswa
        result[date] = {
            "total_tidak_masuk": total_tidak_masuk,
            "is_complete": is_complete,
        }

    return {"data": result}
