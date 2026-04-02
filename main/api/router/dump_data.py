from django.http import HttpResponse
from django.views.decorators.gzip import gzip_page
# from django.db.models import Prefetch

from main.api.api import api
from main.api.core.types import HttpRequest
from main.helpers import database as helpers_database
from main.models import Absensi, Kelas, KunciAbsensi, Siswa, User


@api.get("/data")
@gzip_page
def get_data(request: HttpRequest):
    # sekretaris_qs = User.objects.filter(type=User.TypeChoices.SEKRETARIS)

    kelas_qs = (
        Kelas.objects.only_active()
        # .select_related("wali_kelas")
        # .prefetch_related(Prefetch("sekretaris", sekretaris_qs))
    )
    siswa_qs = (
        Siswa.objects.filter(kelas__active=True)
        # .select_related("kelas", "kelas__wali_kelas")
        # .prefetch_related(Prefetch("kelas__sekretaris", sekretaris_qs))
    )
    absensi_qs = (
        Absensi.objects.filter(siswa__kelas__active=True)
        # .select_related(
        #     "by",
        # )
        # .prefetch_related(Prefetch("siswa", siswa_qs))
        # .prefetch_related(Prefetch("siswa__kelas", kelas_qs))
    )

    lock_absensi_qs = KunciAbsensi.objects.filter(kelas__active=True).filter(
        locked=True
    )

    user = request.auth

    if user.type == User.TypeChoices.KESISWAAN:
        kelas_qs = kelas_qs.filter(active=True)
        absensi_qs = absensi_qs.filter(siswa__kelas__active=True)
        siswa_qs = siswa_qs.filter(kelas__active=True)

    elif user.type == User.TypeChoices.WALI_KELAS:
        kelas_qs = kelas_qs.filter(wali_kelas__pk=user.pk)
        absensi_qs = absensi_qs.filter(siswa__kelas__wali_kelas__pk=user.pk)
        siswa_qs = siswa_qs.filter(kelas__wali_kelas__pk=user.pk)

    elif user.type == User.TypeChoices.SEKRETARIS:
        kelas_qs = kelas_qs.filter(sekretaris__in=[user.pk])
        absensi_qs = absensi_qs.filter(siswa__kelas__sekretaris__in=[user.pk])
        siswa_qs = siswa_qs.filter(kelas__sekretaris__in=[user.pk])

    else:
        kelas_qs = kelas_qs.none()
        absensi_qs = absensi_qs.none()
        siswa_qs = siswa_qs.none()

    conn = helpers_database.dump_to_sqlite(
        kelas_qs, siswa_qs, absensi_qs, lock_absensi_qs
    )
    dump_database_str = ";\n".join(conn.iterdump()) + ";"
    conn.close()

    minimize_dump_database_str = helpers_database.minimize_sql_dump(dump_database_str)

    response = HttpResponse(minimize_dump_database_str, content_type="text/plain")
    return response
