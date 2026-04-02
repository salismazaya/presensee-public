import json
import re
import time
from collections import defaultdict
from datetime import datetime
from typing import List
from dataclasses import dataclass

from dateutil import parser as dateutil_parser
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from lzstring import LZString

from main.api.api import api
from main.api.core.types import HttpRequest
from main.models import Absensi, KunciAbsensi, Siswa, Kelas, User

from ..schemas import (
    DataCompressedUploadSchema,
    DataUploadSchema,
    ErrorSchema,
    SuccessSchema,
)

# Compile regex sekali di module level, bukan setiap request
_DDMMYY_PATTERN = re.compile(
    r"^\b(0?[1-9]|[12][0-9]|3[01])-(0?[1-9]|1[0-2])-\d{2}\b$"
)


@dataclass
class ParsedAction:
    siswa: Siswa  # None untuk lock/unlock
    date: datetime
    payload: dict
    action: str


class UploadView:
    def __init__(self, request: HttpRequest, data: DataUploadSchema):
        self.request = request
        self.data = data
        self._parsed = False
        self.locks = {}                              # "{dd-mm-yyyy}_{kelas_id}" → bool
        self.absensies = {}                          # "{dd-mm-yyyy}_{siswa_id}" → Absensi
        self.kelas_sekretaris = defaultdict(set)     # kelas_id → {user_id, ...}
        self.parsed_actions: List[ParsedAction] = []

    @staticmethod
    def parse_date(date_str: str):
        if _DDMMYY_PATTERN.match(date_str):
            dd, mm, yy = date_str.split("-")
            date = datetime(
                year=2000 + int(yy),
                month=int(mm),
                day=int(dd),
            )
        else:
            try:
                date = dateutil_parser.parse(date_str)
            except dateutil_parser._parser.ParserError:
                raise ValueError("date %s invalid" % date_str)

        # tanggal harus dalam rentang 1 Januari 2020 - hari diabsen
        date_is_invalid = (date.date() > timezone.now().date()) or (
            date.date().year < 2020
        )
        if date_is_invalid:
            raise ValueError("date %s invalid" % date_str)

        return date

    @staticmethod
    def _date_key(date):
        """Format date ke string key. Menerima datetime atau date."""
        d = date.date() if isinstance(date, datetime) else date
        return d.strftime("%d-%m-%Y")

    def _parse_data(self):
        """
        Parse & preload semua data yang dibutuhkan dalam batch.

        Total queries (optimal):
          1. Siswa + Kelas               (select_related)
          2. Kelas sekretaris            (prefetch_related, 2 query)
          3. KunciAbsensi                (1 query)
          4. Absensi + by + siswa.kelas  (select_related, 1 query)
        = ~5 queries total, berapapun jumlah data absensi
        """
        if self._parsed:
            return

        data = self.data

        # urutan: unlock → absen → lock
        # tujuannya agar absen tidak terkunci
        datas = sorted(
            data.data,
            key=lambda x: (
                0 if x.action == "unlock" else 1 if x.action == "absen" else 2
            ),
        )

        # --- Pass 1: kumpulkan semua siswa_id dari action "absen" ---
        raw_payloads = []
        siswa_ids = []

        for d in datas:
            payload = json.loads(d.data)
            raw_payloads.append((d, payload))
            if d.action == "absen":
                siswa_ids.append(payload["siswa"])

        # --- Query 1: Batch load siswas + kelas (1 query) ---
        siswas = {}
        if siswa_ids:
            for s in Siswa.objects.filter(pk__in=siswa_ids).select_related("kelas"):
                siswas[s.pk] = s

        # --- Pass 2: build parsed actions + filter queries ---
        lock_filter_q = None
        absensi_filter_q = None
        kelas_ids_for_sek = set()

        for d, payload in raw_payloads:
            try:
                date = self.parse_date(payload["date"])
            except ValueError:
                continue

            if d.action == "absen":
                siswa = siswas.get(payload["siswa"])
                if not siswa:
                    continue

                self.parsed_actions.append(
                    ParsedAction(siswa=siswa, date=date, payload=payload, action="absen")
                )
                kelas_ids_for_sek.add(siswa.kelas_id)

                # Filter langsung per siswa_id (tanpa JOIN ke kelas)
                q = Q(siswa_id=siswa.pk) & Q(date=date)
                absensi_filter_q = q if absensi_filter_q is None else absensi_filter_q | q

                lq = Q(kelas_id=siswa.kelas_id) & Q(date=date)
                lock_filter_q = lq if lock_filter_q is None else lock_filter_q | lq

            elif d.action in ("lock", "unlock"):
                kelas_id = payload["kelas"]
                self.parsed_actions.append(
                    ParsedAction(siswa=None, date=date, payload=payload, action=d.action)
                )

                lq = Q(kelas_id=kelas_id) & Q(date=date)
                lock_filter_q = lq if lock_filter_q is None else lock_filter_q | lq

        # --- Query 2: Batch load sekretaris per kelas (2 queries via prefetch) ---
        if kelas_ids_for_sek:
            kelas_qs = (
                Kelas.objects
                .filter(pk__in=kelas_ids_for_sek)
                .only("id", "wali_kelas_id")
                .prefetch_related("sekretaris")
            )
            for k in kelas_qs:
                # .all() menggunakan prefetch cache, bukan query baru
                self.kelas_sekretaris[k.pk] = {s.pk for s in k.sekretaris.all()}

        # --- Query 3: Batch load locks (1 query) ---
        if lock_filter_q:
            for lock in KunciAbsensi.objects.filter(lock_filter_q):
                key = f"{self._date_key(lock.date)}_{lock.kelas_id}"
                self.locks[key] = lock.locked

        # --- Query 4: Batch load existing absensies + relasi (1 query) ---
        if absensi_filter_q:
            absensi_qs = (
                Absensi.objects
                .filter(absensi_filter_q)
                .select_related("by", "siswa", "siswa__kelas")
            )
            for a in absensi_qs:
                key = f"{self._date_key(a.date)}_{a.siswa_id}"
                self.absensies[key] = a

        self._parsed = True

    def handle(self):
        user = self.request.auth

        self._parse_data()

        conflicts = []
        new_absensies = []
        updated_absensies = []

        for item in self.parsed_actions:
            payload = item.payload
            date = item.date

            if item.action == "absen":
                siswa = item.siswa

                if not siswa:
                    continue

                # Cek akses menggunakan cache sekretaris (0 query)
                sek_ids = self.kelas_sekretaris.get(siswa.kelas_id, set())
                can_access = (
                    siswa.kelas.wali_kelas_id == user.pk
                ) or user.pk in sek_ids

                if not can_access:
                    continue

                # Cek lock menggunakan preloaded dict (0 query)
                lock_key = f"{self._date_key(date)}_{siswa.kelas_id}"
                if self.locks.get(lock_key, False):
                    transaction.set_rollback(True)
                    return 403, {
                        "detail": f"Tidak bisa melanjutkan aksi. Absen tanggal {date} sedang dikunci, coba hubungi wali kelas atau operator"
                    }

                updated_at_int = int(payload.get("updated_at", time.time()))
                updated_at = datetime.fromtimestamp(updated_at_int).astimezone(
                    settings.TIME_ZONE_OBJ
                )

                absensi_key = f"{self._date_key(date)}_{siswa.pk}"
                absensi = self.absensies.get(absensi_key)

                if absensi is None:
                    # Kumpulkan untuk bulk_create (bukan individual .create())
                    new_absensies.append(Absensi(
                        siswa_id=siswa.pk,
                        date=date,
                        _status=payload["status"],
                        created_at=updated_at,
                        updated_at=updated_at,
                        by_id=user.pk,
                    ))
                elif absensi.by is None:
                    absensi.status = payload["status"]
                    absensi.updated_at = updated_at
                    absensi.by_id = user.pk
                    updated_absensies.append(absensi)
                else:
                    current_status = absensi.status
                    new_status = payload["status"]
                    prev_status = payload.get("previous_status")

                    # by_id lebih cepat dari absensi.by.pk (skip FK lookup)
                    is_same_status = current_status == new_status
                    is_same_user = user.pk == absensi.by_id

                    if not is_same_status and is_same_user:
                        absensi.status = new_status
                        absensi.updated_at = updated_at
                        updated_absensies.append(absensi)

                    elif (
                        not is_same_status
                        and not is_same_user
                        and prev_status is None
                    ):
                        conflicts.append(
                            self._build_conflict(absensi, user, new_status)
                        )

                    elif (
                        not is_same_status
                        and not is_same_user
                        and prev_status
                    ):
                        if (prev_status == current_status) or (
                            current_status == Absensi.StatusChoices.WAIT
                        ):
                            absensi.status = new_status
                            absensi.updated_at = updated_at
                            absensi.by = user
                            updated_absensies.append(absensi)
                        else:
                            conflicts.append(
                                self._build_conflict(absensi, user, new_status)
                            )

            elif item.action in ("lock", "unlock"):
                if user.type != User.TypeChoices.WALI_KELAS:
                    transaction.set_rollback(True)
                    return 403, {"detail": "Ditolak"}

                kelas_id = payload["kelas"]
                is_kelas_owner = Kelas.objects.own(user.pk).filter(pk=kelas_id).exists()
                if not is_kelas_owner:
                    transaction.set_rollback(True)
                    return 403, {"detail": "Ditolak"}

                locked = item.action == "lock"

                KunciAbsensi.objects.update_or_create(
                    date=date,
                    kelas__pk=kelas_id,
                    defaults={"locked": locked, "date": date, "kelas_id": kelas_id},
                )

                # Update in-memory lock state agar absen berikutnya
                # dalam request yang sama melihat state terbaru
                lock_key = f"{self._date_key(date)}_{kelas_id}"
                self.locks[lock_key] = locked

        # --- Batch DB operations (2 query max, bukan N) ---
        if new_absensies:
            Absensi.objects.bulk_create(new_absensies)

        if updated_absensies:
            Absensi.objects.bulk_update(
                updated_absensies, ["_status", "updated_at", "by_id"]
            )

        return {"data": {"conflicts": conflicts}}

    @staticmethod
    def _build_conflict(absensi, user, new_status):
        """Build conflict dict. Semua field sudah preloaded via select_related."""
        return {
            "type": "absensi",
            "absensi_id": absensi.pk,
            "absensi_siswa": absensi.siswa.fullname,
            "absensi_siswa_id": absensi.siswa.pk,
            "absensi_kelas_id": absensi.siswa.kelas.pk,
            "absensi_date": absensi.date,
            "other": {
                "display_name": str(absensi.by),
                "absensi_status": absensi.status,
            },
            "self": {
                "display_name": str(user),
                "absensi_status": new_status,
            },
        }


@api.post("/upload", response={403: ErrorSchema, 400: ErrorSchema, 200: SuccessSchema})
@transaction.atomic
def upload(request: HttpRequest, data: DataUploadSchema):
    view = UploadView(request, data)
    rv = view.handle()
    return rv


@api.post("/compressed-upload", response={403: ErrorSchema, 200: SuccessSchema})
def compressed_upload(request: HttpRequest, data: DataCompressedUploadSchema):
    lz = LZString()

    data_decompressed_json = lz.decompressFromBase64(data.data)
    data_decompressed = json.loads(data_decompressed_json)

    data_upload = DataUploadSchema(data=data_decompressed)
    return upload(request, data_upload)
