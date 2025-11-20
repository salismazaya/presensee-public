import asyncio
import json
import threading
from datetime import datetime

from asgiref.sync import async_to_sync, sync_to_async
# from main.helpers import json as json_helpers
from dateutil import parser as dateutil_parser
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.db.models.functions import ExtractMonth, ExtractYear
from django.http import HttpRequest, HttpResponse
from django.utils.crypto import get_random_string
from ninja import NinjaAPI
from ninja.security import HttpBearer
from ninja.throttling import AnonRateThrottle, AuthRateThrottle

from main.api_schemas import (ChangePasswordSchema, DataUploadSchema,
                              ErrorSchema, LoginSchema, SuccessSchema)
from main.helpers import database as helpers_database
from main.helpers import pdf as helpers_pdf
from main.helpers.humanize import localize_month_to_string
from main.models import Absensi, Kelas, KunciAbsensi, Siswa, User


class HttpRequest(HttpRequest):
    auth: User | None

class AuthBearer(HttpBearer):
    def authenticate(self, request: HttpRequest, token):
        if not token:
            return
        
        user = User.objects.filter(token = token).first()
        return user

api = NinjaAPI(
    auth = AuthBearer(),
    docs = False,
    docs_url = False,
    throttle = [
        # TODO: ganti ke redis. throttle seperti ini tidak akurat jika multi worker
        AnonRateThrottle("1/s"),
        AnonRateThrottle("30/m"),
        AuthRateThrottle("60/m"),
    ]
)

@api.get('/version', auth = None, throttle = [])
def get_version(request: HttpRequest):
    return HttpResponse(settings.PRESENSEE_VERSION)


@api.post('/login', auth = None, response = {403: ErrorSchema, 200: SuccessSchema})
def login(request: HttpRequest, data: LoginSchema):
    user = User.objects.filter(username = data.username).first()
    if user is None:
        return 403, {"detail": "Username/password salah"}

    if not user.check_password(data.password):
        return 403, {"detail": "Username/password salah"}
    
    user.token = get_random_string(20)
    user.save()

    return 200, {"data": {"token": user.token}}


@api.post('/change-password', response = {403: ErrorSchema, 200: SuccessSchema})
def login(request: HttpRequest, data: ChangePasswordSchema):
    if not request.auth.check_password(data.old_password):
        return 403, {"detail": "Password salah!"}
    
    request.auth.set_password(data.new_password)
    request.auth.save()
    return 200, {"data": {"success": True}}

@api.get('/me')
def get_me(request: HttpRequest):
    kelas_obj = Kelas.objects.filter(
        Q(wali_kelas__pk = request.auth.pk) | Q(sekretaris__in = [request.auth.pk])
    ).first()
    kelas = None

    if kelas_obj:
        kelas = kelas_obj.pk

    return {'data': {'username': request.auth.username, "type": request.auth.type, "kelas": kelas}}


@api.post('/upload', response = {403: ErrorSchema, 200: SuccessSchema})
@transaction.atomic
def upload(request: HttpRequest, data: DataUploadSchema):
    # TODO: terlalu spageti, ubah ke class based view
    user = request.auth

    conflicts = []

    datas = sorted(data.data, key = lambda x: 1 if x.action == "absen" else 0) 

    for x in datas:
        payload = json.loads(x.data)
        # dd, mm, yy = payload['date'].split("-")
        date = dateutil_parser.parse(payload['date'])

        dd = date.day
        mm = date.month
        yy = date.year % 2000

        date = datetime(
            year = 2000 + int(yy),
            month = int(mm),
            day = int(dd)
        ).date()

        if x.action == "absen":
            updated_at_int = int(payload['updated_at'])
            updated_at = datetime.fromtimestamp(updated_at_int)

            siswa = Siswa.objects.filter(pk = payload["siswa"]).first()
            if not siswa:
                continue
    
            if (siswa.kelas.wali_kelas and siswa.kelas.wali_kelas.pk == user.pk) or \
                siswa.kelas.sekretaris.filter(pk = user.pk).exists():
                lock = KunciAbsensi.objects.filter(date = date).filter(kelas__pk = siswa.kelas.pk).first()
                
                if lock and lock.locked:
                    transaction.set_rollback(True)
                    return 403, {"detail": f"Tidak bisa melanjutkan aksi. Absen tanggal {date} sedang dikunci, coba hubungi wali kelas atau operator"}

                # Absensi.objects.update_or_create(
                #     siswa_id = siswa.pk,
                #     date = date,
                #     defaults = {
                #         'status': payload["status"]
                #     }
                # )

                absensi = (
                    Absensi.objects
                        .filter(siswa__pk = siswa.pk, date = date)
                        .first()
                )

                if absensi is None:
                    Absensi.objects.create(
                        siswa_id = siswa.pk,
                        date = date,
                        status = payload['status'],
                        # karena ini insert berarti updated_at=created_at
                        created_at = updated_at,
                        updated_at = updated_at,
                        by_id = user.pk,
                    )
                elif absensi.by is None:
                    # absensi bukan None karena sudah divalidasi diatas
                    absensi.status = payload['status']
                    absensi.updated_at = updated_at
                    absensi.by_id = user.pk
                    absensi.save()
                else:
                    current_absensi_status = absensi.status
                    absensi_status = payload['status']
                    previous_absensi_status = payload.get('previous_status')

                    is_absensi_status_same = current_absensi_status == absensi_status
                    is_user_same = user.pk == absensi.by.pk

                    if not is_absensi_status_same and is_user_same:
                        absensi.status = payload['status']
                        absensi.updated_at = updated_at
                        absensi.save()

                    elif not is_absensi_status_same and not is_user_same and previous_absensi_status is None:
                        conflict = {
                            'type': 'absensi',
                            'absensi_id': absensi.pk,
                            'absensi_siswa': absensi.siswa.fullname,
                            'absensi_siswa_id': absensi.siswa.pk,
                            'absensi_kelas_id': absensi.siswa.kelas.pk,
                            'absensi_date': absensi.date,
                            'other': {
                                'display_name': str(absensi.by),
                                'absensi_status': current_absensi_status,
                            },
                            'self': {
                                'display_name': str(user),
                                'absensi_status': absensi_status
                            }
                        }

                        conflicts.append(conflict)
                    
                    elif not is_absensi_status_same and not is_user_same and previous_absensi_status:
                        if previous_absensi_status == current_absensi_status:
                            absensi.status = payload['status']
                            absensi.updated_at = updated_at
                            absensi.by = user
                            absensi.save()
                        else:
                            conflict = {
                                'type': 'absensi',
                                'absensi_id': absensi.pk,
                                'absensi_siswa': absensi.siswa.fullname,
                                'absensi_siswa_id': absensi.siswa.pk,
                                'absensi_kelas_id': absensi.siswa.kelas.pk,
                                'absensi_date': absensi.date,
                                'other': {
                                    'display_name': str(absensi.by),
                                    'absensi_status': current_absensi_status,
                                },
                                'self': {
                                    'display_name': str(user),
                                    'absensi_status': absensi_status
                                }
                            }

                            conflicts.append(conflict)

        
        elif x.action == "lock":
            KunciAbsensi.objects.update_or_create(date = date, kelas__pk = payload["kelas"], defaults = {
                'locked': True,
                'date': date,
                'kelas_id': payload['kelas']
            })
    
        elif x.action == "unlock":
            KunciAbsensi.objects.update_or_create(date = date, kelas__pk = payload["kelas"], defaults = {
                'locked': False,
                'date': date,
                'kelas_id': payload['kelas']
            })

    return {'data': {'conflicts': conflicts}}

REKAP_THREADING_LOCK = threading.Lock()

import uuid

from main.helpers import redis


@api.get('/get-rekap', response = {404: ErrorSchema, 500: ErrorSchema, 200: SuccessSchema})
def get_rekap(request: HttpRequest, bulan: int, kelas: int, tahun: int):
    cache_key = f"rekap_{bulan}_{tahun}_{kelas}"
    
    kelas_obj = Kelas.objects.filter(pk = kelas).first()

    bulan_str = localize_month_to_string(bulan)

    if not kelas_obj:
        return 404, {'detail': 'kelas not found'}

    is_kesiswaan = request.auth.type == 'kesiswaan'
    is_wali_kelas = request.auth.type == 'wali_kelas' and kelas_obj.wali_kelas.pk == request.auth.pk
    is_sekretaris = request.auth.type == 'sekretaris' and kelas_obj.sekretaris.filter(pk = request.auth.pk).exists()

    can_access = is_kesiswaan or is_wali_kelas or is_sekretaris

    if not can_access:
        return 404, {'detail': 'kelas not found'}

    # CACHING FILE ID
    with redis.get_client() as redis_client:
        cached_file_id = redis_client.get(cache_key)
        if cached_file_id:
            return {'data': {'file_id': cached_file_id.decode()}}

    with REKAP_THREADING_LOCK: # hanya 1 pembuatan pdf dalam 1 waktu (per worker)
        file = helpers_pdf.generate_pdf(
            kelas_obj,
            bulan,
            tahun
        )        

    filename = 'Rekap %s-%s%s.pdf' % (kelas_obj.name, bulan_str, tahun)
    filename = filename.replace(" ", "-")
    filename_with_padding = filename.encode().ljust(100, b'\r')

    mimetype = 'application/pdf'
    mimetype_with_padding = mimetype.encode().ljust(100, b'\r')

    file_with_filename = filename_with_padding + mimetype_with_padding + file

    with redis.get_client() as redis_client:
        file_id = str(uuid.uuid4())

        # file akan kadaluarsa/terhapus dalam 24 jam
        redis_client.set(file_id, file_with_filename, ex = 3600 * 24)

        # cache file_id agar tidak diproses ulang. cek sekitar line 153
        # cache diatur 6 jam
        redis_client.set(cache_key, file_id, ex = 3600 * 6)

    return {'data': {'file_id': file_id}}


@api.get('/data')
def get_data(request: HttpRequest):
    kelas_qs = (
        Kelas.objects
            .filter(active = True)
    )

    absensi_qs = (
        Absensi.objects
            .filter(siswa__kelas__active = True)
    )

    siswa_qs = (
        Siswa.objects
            .filter(kelas__active = True)
    )

    lock_absensi_qs = (
        KunciAbsensi.objects
            .filter(kelas__active = True)
            .filter(locked = True)
    )

    user = request.auth

    if user.type == User.TypeChoices.KESISWAAN:
        kelas_qs = kelas_qs.all()
        absensi_qs = absensi_qs.all()
        siswa_qs = siswa_qs.all()

    elif user.type == User.TypeChoices.WALI_KELAS:
        kelas_qs = kelas_qs.filter(wali_kelas__pk = user.pk)
        absensi_qs = absensi_qs.filter(siswa__kelas__wali_kelas__pk = user.pk)
        siswa_qs = siswa_qs.filter(kelas__wali_kelas__pk = user.pk)

    elif user.type == User.TypeChoices.SEKRETARIS:
        kelas_qs = kelas_qs.filter(sekretaris__in = [user.pk])
        absensi_qs = absensi_qs.filter(siswa__kelas__sekretaris__in = [user.pk])
        siswa_qs = siswa_qs.filter(kelas__sekretaris__in = [user.pk])

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
        execute = sync_to_async(len, thread_sensitive = False)
        # TODO: atur agar threading tidak bengkak saat banyak user hit endpoint ini

        await asyncio.gather(
            execute(kelas_qs),
            execute(absensi_qs),
            execute(siswa_qs),
            execute(lock_absensi_qs),
        )
    
    # call in sync context
    hit_database()

    conn = helpers_database.dump_to_sqlite(kelas_qs, siswa_qs, absensi_qs, lock_absensi_qs)
    dump_database_str = ";\n".join(conn.iterdump()) + ";"
    conn.close()

    return HttpResponse(dump_database_str)


@api.get('/bulan')
def get_bulan_absensi(request: HttpRequest):
    user = request.auth

    queryset = (
        Absensi.objects
        .annotate(
            bulan_num = ExtractMonth('date'),
            tahun_num = ExtractYear('date'),
        )
        .values('bulan_num', 'tahun_num')
        .distinct()
        .order_by('tahun_num', 'bulan_num')
    )

    if user.type != User.TypeChoices.KESISWAAN:
        queryset = queryset.filter(
            Q(siswa__kelas__wali_kelas__pk = user.pk) | 
            Q(siswa__kelas__sekretaris__in = [user.pk]) 
        )

    hasil = []
    for q in queryset:
        bulan = f"{q['bulan_num']:02d}-{str(q['tahun_num'])[-2:]}"
        bulan_humanize = f"{localize_month_to_string(q['bulan_num'])} {q['tahun_num']}"
        hasil.append({
            'bulan': bulan,
            'bulan_humanize': bulan_humanize
        })

    return {'data': hasil}


@api.get('/absensi', response = {404: ErrorSchema, 200: SuccessSchema})
def get_absensies(request: HttpRequest, date: str, kelas_id: int):
    # TODO: handle error parsing
    date = dateutil_parser.parse(date).date()
    kelas = (
        Kelas.extra_objects
            .own(request.auth.pk)
            .filter(pk = kelas_id)
            .first()
    )

    if kelas is None:
        return 404, {"detail": "kelas tidak ditemukan"}

    result = {}

    siswas = kelas.siswas.all()
    for siswa in siswas:
        absensi = Absensi.objects.filter(
            date = date,
            siswa__pk = siswa.pk
        ).first()

        if absensi:
            result[siswa.pk] = absensi.status
        else:
            result[siswa.pk] = None
    
    return {'data': result}


@api.get('/absensi/complete', response = {400: ErrorSchema, 200: SuccessSchema})
def get_absensi_complete(request: HttpRequest, kelas_id: int, dates: str):
    dates = dates.split(',')

    if len(dates) >= 32:
        return 400, {'detail': 'terlalu banyak input tanggal'}

    total_siswa = (
        Siswa.objects
            .filter(
                kelas__pk = kelas_id
            )
            .count()
    )

    result = {}

    for date in dates:
        try:
            date_obj = dateutil_parser.parse(date)
        except ValueError:
            return 400, {'detail': 'gagal parsing %s' % date}

        total_absensi = (
            Absensi.objects
                .filter(
                    siswa__kelas__pk = kelas_id
                )
                .filter(
                    date = date_obj
                ).count()
        )

        is_complete = total_absensi == total_siswa

        result[date] = is_complete

    return {'data': result}
        
