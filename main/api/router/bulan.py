from django.db.models import Q
from django.db.models.functions import ExtractMonth, ExtractYear

from main.api.api import api
from main.api.core.types import HttpRequest
from main.helpers.humanize import localize_month_to_string
from main.models import Absensi, User


@api.get("/bulan")
def get_bulan_absensi(request: HttpRequest):
    user = request.auth

    queryset = (
        Absensi.objects.filter_domain(request)
        .annotate(
            bulan_num=ExtractMonth("date"),
            tahun_num=ExtractYear("date"),
        )
        .values("bulan_num", "tahun_num")
        .distinct()
        .order_by("tahun_num", "bulan_num")
    )

    if user.type != User.TypeChoices.KESISWAAN:
        queryset = queryset.filter(
            Q(siswa__kelas__wali_kelas__pk=user.pk)
            | Q(siswa__kelas__sekretaris__in=[user.pk])
        )

    hasil = []
    for q in queryset:
        bulan = f"{q['bulan_num']:02d}-{str(q['tahun_num'])[-2:]}"
        bulan_humanize = f"{localize_month_to_string(q['bulan_num'])} {q['tahun_num']}"
        hasil.append({"bulan": bulan, "bulan_humanize": bulan_humanize})

    return {"data": hasil}
