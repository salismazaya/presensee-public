from django.http import HttpResponse
from django.views.decorators.gzip import gzip_page

from main.api.api import api
from main.api.core.types import HttpRequest
from main.helpers import database as helpers_database
from main.models import Absensi, Kelas, KunciAbsensi, Siswa, User


def _filter_queryset_by_nested_attr(queryset, attr_path: str, expected_value):
    filtered_objects = []

    for obj in queryset:
        attr_names = attr_path.split("__")
        current_value = obj

        for attr in attr_names:
            if attr == "in":
                all_manytomany_data = current_value.all()
                # print(all_manytomany_data)

                for data in all_manytomany_data:
                    if data.pk in expected_value:
                        filtered_objects.append(obj)

            current_value = getattr(current_value, attr, None)
            if current_value is None:
                break

        if current_value == expected_value:
            filtered_objects.append(obj)

    return filtered_objects


@api.get("/data")
@gzip_page
def get_data(request: HttpRequest):
    kelas_qs = (
        Kelas.objects.only_active()
        .select_related("wali_kelas")
        .prefetch_related("sekretaris")
    )
    siswa_qs = Siswa.objects.filter(kelas__active=True).select_related("kelas")
    absensi_qs = (
        Absensi.objects.filter(siswa__kelas__active=True)
        .select_related("siswa", "by", "siswa__kelas", "siswa__kelas__wali_kelas")
        .prefetch_related("siswa__kelas__sekretaris")
    )

    lock_absensi_qs = KunciAbsensi.objects.filter(kelas__active=True).filter(
        locked=True
    )

    user = request.auth

    if user.type == User.TypeChoices.KESISWAAN:
        kelas = _filter_queryset_by_nested_attr(kelas_qs, "active", True)
        absensi = _filter_queryset_by_nested_attr(
            absensi_qs, "siswa__kelas__active", True
        )
        siswa = _filter_queryset_by_nested_attr(siswa_qs, "kelas__active", True)

    elif user.type == User.TypeChoices.WALI_KELAS:
        # kelas_qs = kelas_qs.filter(wali_kelas__pk=user.pk)
        # absensi_qs = absensi_qs.filter(siswa__kelas__wali_kelas__pk=user.pk)
        # siswa_qs = siswa_qs.filter(kelas__wali_kelas__pk=user.pk)

        kelas = _filter_queryset_by_nested_attr(kelas_qs, "wali_kelas__pk", user.pk)
        absensi = _filter_queryset_by_nested_attr(
            absensi_qs, "siswa__kelas__wali_kelas__pk", user.pk
        )
        siswa = _filter_queryset_by_nested_attr(
            siswa_qs, "kelas__wali_kelas__pk", user.pk
        )

    elif user.type == User.TypeChoices.SEKRETARIS:
        # kelas_qs = kelas_qs.filter(sekretaris__in=[user.pk])
        # absensi_qs = absensi_qs.filter(siswa__kelas__sekretaris__in=[user.pk])
        # siswa_qs = siswa_qs.filter(kelas__sekretaris__in=[user.pk])

        kelas = _filter_queryset_by_nested_attr(kelas_qs, "sekretaris__in", [user.pk])
        absensi = _filter_queryset_by_nested_attr(
            absensi_qs, "siswa__kelas__sekretaris__in", [user.pk]
        )
        siswa = _filter_queryset_by_nested_attr(
            siswa_qs, "kelas__sekretaris__in", [user.pk]
        )

    else:
        # kelas_qs = kelas_qs.none()
        # absensi_qs = absensi_qs.none()
        # siswa_qs = siswa_qs.none()

        siswa = []
        absensi = []
        kelas = []

    conn = helpers_database.dump_to_sqlite(kelas, siswa, absensi, lock_absensi_qs)
    dump_database_str = ";\n".join(conn.iterdump()) + ";"
    conn.close()

    minimize_dump_database_str = helpers_database.minimize_sql_dump(dump_database_str)

    response = HttpResponse(minimize_dump_database_str, content_type="text/plain")
    return response
