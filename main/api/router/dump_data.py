import asyncio

from asgiref.sync import async_to_sync, sync_to_async
from django.http import HttpResponse

from main.api.api import api
from main.api.core.types import HttpRequest
from main.helpers import database as helpers_database
from main.models import Absensi, Kelas, KunciAbsensi, Siswa, User


@api.get("/data")
def get_data(request: HttpRequest):
    kelas_qs = Kelas.objects.filter_domain(request).filter(active=True)

    absensi_qs = Absensi.objects.filter_domain(request).filter(
        siswa__kelas__active=True
    )

    siswa_qs = Siswa.objects.filter_domain(request).filter(kelas__active=True)

    lock_absensi_qs = (
        KunciAbsensi.objects.filter_domain(request)
        .filter(kelas__active=True)
        .filter(locked=True)
    )

    user = request.auth

    if user.type == User.TypeChoices.KESISWAAN:
        kelas_qs = kelas_qs.filter_domain(request).filter(active=True)
        absensi_qs = absensi_qs.filter_domain(request).filter(siswa__kelas__active=True)
        siswa_qs = siswa_qs.filter_domain(request).filter(kelas__active=True)

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

    @async_to_sync
    async def hit_database():
        """
        menggunakan async agar 4 tabel dieksekusi secara bersamaan
        """

        # queryset di django itu lazy. salah satu cara untuk mengeksekusinya
        # adalah menghitung row-nya (len)
        #
        # tidak menggunakan thread-sensitive (=False)
        # karena tetap aman meskipun terjadi race condition
        execute = sync_to_async(len, thread_sensitive=False)
        # TODO: atur agar threading tidak bengkak saat banyak user hit endpoint ini

        await asyncio.gather(
            execute(kelas_qs),
            execute(absensi_qs),
            execute(siswa_qs),
            execute(lock_absensi_qs),
        )

    # call in sync context
    hit_database()

    conn = helpers_database.dump_to_sqlite(
        kelas_qs, siswa_qs, absensi_qs, lock_absensi_qs
    )
    dump_database_str = ";\n".join(conn.iterdump()) + ";"
    conn.close()

    return HttpResponse(dump_database_str)
