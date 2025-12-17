from dateutil import parser as dateutil_parser

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

    kelas = (
        Kelas.extra_objects.own(request.auth.pk)
        .filter_domain(request)
        .filter(pk=kelas_id)
        .first()
    )

    if kelas is None:
        return 404, {"detail": "kelas tidak ditemukan"}

    result = {}
    siswas = kelas.siswas.all()

    for siswa in siswas:
        absensi = (
            Absensi.objects.filter_domain(request)
            .filter(date=date, siswa__pk=siswa.pk)
            .first()
        )

        if absensi:
            result[siswa.pk] = absensi.status
        else:
            result[siswa.pk] = None

    return {"data": result}


@api.get("/absensi/progress", response={400: ErrorSchema, 200: SuccessSchema})
def get_absensi_progress(request: HttpRequest, kelas_id: int, dates: str):
    dates = dates.split(",")

    if len(dates) >= 32:
        return 400, {"detail": "terlalu banyak input tanggal"}

    total_siswa = (
        Siswa.objects.filter_domain(request).filter(kelas__pk=kelas_id).count()
    )

    result = {}

    for date in dates:
        try:
            date_obj = dateutil_parser.parse(date)
        except ValueError:
            return 400, {"detail": "gagal parsing %s" % date}

        total_absensi = (
            Absensi.objects.filter_domain(request)
            .filter(siswa__kelas__pk=kelas_id)
            .filter(date=date_obj)
            .count()
        )

        total_tidak_masuk = (
            Absensi.objects.filter_domain(request)
            .filter(date=date_obj)
            .filter(siswa__kelas__pk=kelas_id)
            .exclude(_status=Absensi.StatusChoices.HADIR)
            .count()
        )

        is_complete = total_absensi == total_siswa

        result[date] = {
            "total_tidak_masuk": total_tidak_masuk,
            "is_complete": is_complete,
        }

    return {"data": result}
