"""
Test konsistensi data API Presensee.

Memastikan bahwa data yang ditulis melalui API konsisten ketika
dibaca kembali, baik melalui endpoint yang sama maupun endpoint
yang berbeda. Juga mengecek invariant-invariant pada level model.
"""

import json
import time
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from django.conf import settings
from django.db import IntegrityError
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from main.api.api import api
from main.models import Absensi, AbsensiSession, Kelas, KunciAbsensi, Siswa, User


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _make_upload_payload(siswa_pk: int, date_str: str, status: str,
                         previous_status: str = None) -> dict:
    """Buat payload upload absensi standar."""
    payload = {
        "date": date_str,
        "siswa": siswa_pk,
        "status": status,
        "updated_at": int(time.time()),
    }
    if previous_status is not None:
        payload["previous_status"] = previous_status
    return {
        "action": "absen",
        "data": json.dumps(payload),
    }


def _make_lock_payload(kelas_pk: int, date_str: str, action: str) -> dict:
    """Buat payload lock/unlock standar."""
    return {
        "action": action,
        "data": json.dumps({"kelas": kelas_pk, "date": date_str}),
    }


# ===================================================================
# 1. Konsistensi constraint level model (tanpa API)
# ===================================================================

@override_settings(DEBUG=True)
class ModelConstraintConsistencyTest(TestCase):
    """Memastikan constraint DB menjaga konsistensi data."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        api.throttle = []

    def setUp(self):
        self.user = User.objects.create_user(
            username="constraint_user", password="pw",
            full_name="Constraint User", type="kesiswaan",
        )
        self.kelas = Kelas.objects.create(name="Constraint-Kelas", active=True)
        self.siswa = Siswa.objects.create(fullname="Siswa Constraint", kelas=self.kelas)

    # --- unique_together (date, siswa) pada Absensi ---
    def test_absensi_duplicate_date_siswa_raises(self):
        """Tidak boleh ada 2 absensi dengan (date, siswa) yang sama."""
        today = timezone.now().date()
        Absensi.objects.create(
            date=today, siswa=self.siswa, _status="hadir", by=self.user,
        )
        with self.assertRaises(IntegrityError):
            Absensi.objects.create(
                date=today, siswa=self.siswa, _status="sakit", by=self.user,
            )

    # --- CheckConstraint: wait_expired_at harus ada saat status=tunggu ---
    def test_absensi_tunggu_without_wait_expired_at_raises(self):
        """Status tunggu tanpa wait_expired_at harus ditolak oleh DB."""
        today = timezone.now().date()
        with self.assertRaises(IntegrityError):
            Absensi.objects.create(
                date=today, siswa=self.siswa,
                _status="tunggu",
                wait_expired_at=None,
                by=self.user,
            )

    def test_absensi_tunggu_with_wait_expired_at_ok(self):
        """Status tunggu dengan wait_expired_at valid tidak error."""
        today = timezone.now().date()
        absensi = Absensi.objects.create(
            date=today, siswa=self.siswa,
            _status="tunggu",
            wait_expired_at=timezone.now() + timedelta(hours=6),
            by=self.user,
        )
        self.assertEqual(absensi._status, "tunggu")
        self.assertIsNotNone(absensi.wait_expired_at)

    # --- FK integrity: Siswa harus punya Kelas ---
    def test_siswa_must_have_kelas(self):
        """Siswa tanpa kelas harus ditolak."""
        with self.assertRaises(IntegrityError):
            Siswa.objects.create(fullname="No-Kelas", kelas_id=None)

    # --- unique Kelas name ---
    def test_kelas_name_unique(self):
        """Nama kelas harus unik."""
        with self.assertRaises(IntegrityError):
            Kelas.objects.create(name="Constraint-Kelas", active=True)

    # --- KunciAbsensi unique_together (kelas, date) ---
    def test_kunci_absensi_duplicate_raises(self):
        """Tidak boleh ada 2 kunci absensi untuk (kelas, date) yang sama."""
        today = timezone.now().date()
        KunciAbsensi.objects.create(kelas=self.kelas, date=today, locked=True)
        with self.assertRaises(IntegrityError):
            KunciAbsensi.objects.create(kelas=self.kelas, date=today, locked=False)


# ===================================================================
# 2. Konsistensi round-trip Upload → Read
# ===================================================================

@override_settings(DEBUG=True)
class UploadReadConsistencyTest(TestCase):
    """Memastikan data yang di-upload konsisten ketika dibaca kembali."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        api.throttle = []

    def setUp(self):
        self.client = Client()

        # Wali kelas
        self.wali = User.objects.create_user(
            username="wali", password="pw", full_name="Wali Kelas", type="wali_kelas",
        )
        self.wali.token = "walitoken"
        self.wali.save()

        # Kesiswaan (untuk read)
        self.kesiswaan = User.objects.create_user(
            username="kesiswaan", password="pw", full_name="Kesiswaan", type="kesiswaan",
        )
        self.kesiswaan.token = "kesiswaantoken"
        self.kesiswaan.save()

        self.kelas = Kelas.objects.create(name="RT-Kelas", active=True, wali_kelas=self.wali)
        self.siswa1 = Siswa.objects.create(fullname="Siswa RT-1", kelas=self.kelas)
        self.siswa2 = Siswa.objects.create(fullname="Siswa RT-2", kelas=self.kelas)
        self.siswa3 = Siswa.objects.create(fullname="Siswa RT-3", kelas=self.kelas)

        self.date_str = "21-03-26"  # DD-MM-YY → 2026-03-21
        self.date_iso = "2026-03-21"

    def _upload(self, payloads: list, token: str = "walitoken"):
        return self.client.post(
            "/api/upload",
            data={"data": payloads},
            content_type="application/json",
            headers={"Authorization": f"Bearer {token}"},
        )

    def test_upload_then_read_absensi_matches(self):
        """Status absensi yang di-upload harus sesuai saat dibaca."""
        payloads = [
            _make_upload_payload(self.siswa1.pk, self.date_str, "hadir"),
            _make_upload_payload(self.siswa2.pk, self.date_str, "sakit"),
            _make_upload_payload(self.siswa3.pk, self.date_str, "alfa"),
        ]

        resp_upload = self._upload(payloads)
        self.assertEqual(resp_upload.status_code, 200)
        self.assertEqual(resp_upload.json()["data"]["conflicts"], [])

        # Baca via GET /api/absensi
        resp_read = self.client.get(
            f"/api/absensi?date={self.date_iso}&kelas_id={self.kelas.pk}",
            headers={"Authorization": "Bearer kesiswaantoken"},
        )
        self.assertEqual(resp_read.status_code, 200)

        data = resp_read.json()["data"]
        self.assertEqual(data[str(self.siswa1.pk)], "hadir")
        self.assertEqual(data[str(self.siswa2.pk)], "sakit")
        self.assertEqual(data[str(self.siswa3.pk)], "alfa")

    def test_upload_update_then_read_latest(self):
        """Update status absensi harus menimpa data lama (user sama)."""
        # Upload awal
        self._upload([
            _make_upload_payload(self.siswa1.pk, self.date_str, "hadir"),
        ])

        # Update ke sakit (user sama → langsung overwrite)
        self._upload([
            _make_upload_payload(self.siswa1.pk, self.date_str, "sakit"),
        ])

        resp = self.client.get(
            f"/api/absensi?date={self.date_iso}&kelas_id={self.kelas.pk}",
            headers={"Authorization": "Bearer kesiswaantoken"},
        )
        data = resp.json()["data"]
        self.assertEqual(data[str(self.siswa1.pk)], "sakit")

    def test_upload_all_then_progress_complete(self):
        """Jika semua siswa diabsen, progress should show is_complete=True."""
        payloads = [
            _make_upload_payload(s.pk, self.date_str, "hadir")
            for s in [self.siswa1, self.siswa2, self.siswa3]
        ]
        self._upload(payloads)

        resp = self.client.get(
            f"/api/absensi/progress?kelas_id={self.kelas.pk}&dates={self.date_iso}",
            headers={"Authorization": "Bearer kesiswaantoken"},
        )
        self.assertEqual(resp.status_code, 200)
        progress = resp.json()["data"][self.date_iso]
        self.assertTrue(progress["is_complete"])
        self.assertEqual(progress["total_tidak_masuk"], 0)

    def test_upload_partial_then_progress_incomplete(self):
        """Jika hanya sebagian siswa diabsen, is_complete harus False."""
        # Hanya absen 1 dari 3 siswa
        self._upload([
            _make_upload_payload(self.siswa1.pk, self.date_str, "hadir"),
        ])

        resp = self.client.get(
            f"/api/absensi/progress?kelas_id={self.kelas.pk}&dates={self.date_iso}",
            headers={"Authorization": "Bearer kesiswaantoken"},
        )
        progress = resp.json()["data"][self.date_iso]
        self.assertFalse(progress["is_complete"])

    def test_progress_tidak_masuk_count_accurate(self):
        """Jumlah total_tidak_masuk harus akurat."""
        payloads = [
            _make_upload_payload(self.siswa1.pk, self.date_str, "hadir"),
            _make_upload_payload(self.siswa2.pk, self.date_str, "sakit"),
            _make_upload_payload(self.siswa3.pk, self.date_str, "alfa"),
        ]
        self._upload(payloads)

        resp = self.client.get(
            f"/api/absensi/progress?kelas_id={self.kelas.pk}&dates={self.date_iso}",
            headers={"Authorization": "Bearer kesiswaantoken"},
        )
        progress = resp.json()["data"][self.date_iso]
        # sakit + alfa = 2 tidak masuk
        self.assertEqual(progress["total_tidak_masuk"], 2)
        self.assertTrue(progress["is_complete"])


# ===================================================================
# 3. Konsistensi Lock (KunciAbsensi)
# ===================================================================

@override_settings(DEBUG=True)
class LockConsistencyTest(TestCase):
    """Memastikan mekanisme lock menjaga konsistensi data."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        api.throttle = []

    def setUp(self):
        self.client = Client()

        self.wali = User.objects.create_user(
            username="wali_lock", password="pw", full_name="Wali Lock", type="wali_kelas",
        )
        self.wali.token = "walilocktoken"
        self.wali.save()

        self.kelas = Kelas.objects.create(name="Lock-Kelas", active=True, wali_kelas=self.wali)
        self.siswa = Siswa.objects.create(fullname="Siswa Lock", kelas=self.kelas)
        self.date_str = "21-03-26"
        self.date_iso = "2026-03-21"

    def _upload(self, payloads, token="walilocktoken"):
        return self.client.post(
            "/api/upload",
            data={"data": payloads},
            content_type="application/json",
            headers={"Authorization": f"Bearer {token}"},
        )

    def test_lock_blocks_subsequent_upload(self):
        """Upload absensi setelah lock harus ditolak (403)."""
        # Absen dulu
        self._upload([_make_upload_payload(self.siswa.pk, self.date_str, "hadir")])

        # Lock
        self._upload([_make_lock_payload(self.kelas.pk, self.date_str, "lock")])

        # Coba upload lagi → harus ditolak
        resp = self._upload([_make_upload_payload(self.siswa.pk, self.date_str, "sakit")])
        self.assertEqual(resp.status_code, 403)

        # Data harus tetap 'hadir' (tidak berubah)
        absensi = Absensi.objects.get(siswa=self.siswa, date="2026-03-21")
        self.assertEqual(absensi._status, "hadir")

    def test_unlock_allows_upload(self):
        """Setelah unlock, upload harus bisa dilakukan lagi."""
        # Absen → lock → unlock → absen lagi
        self._upload([_make_upload_payload(self.siswa.pk, self.date_str, "hadir")])
        self._upload([_make_lock_payload(self.kelas.pk, self.date_str, "lock")])
        self._upload([_make_lock_payload(self.kelas.pk, self.date_str, "unlock")])

        resp = self._upload([_make_upload_payload(self.siswa.pk, self.date_str, "sakit")])
        self.assertEqual(resp.status_code, 200)

        absensi = Absensi.objects.get(siswa=self.siswa, date="2026-03-21")
        self.assertEqual(absensi._status, "sakit")

    def test_lock_only_by_wali_kelas(self):
        """Hanya wali kelas yang bisa lock/unlock."""
        sekretaris = User.objects.create_user(
            username="sek_lock", password="pw", full_name="Sek", type="sekretaris",
        )
        sekretaris.token = "sektoken"
        sekretaris.save()
        self.kelas.sekretaris.add(sekretaris)

        resp = self._upload(
            [_make_lock_payload(self.kelas.pk, self.date_str, "lock")],
            token="sektoken",
        )
        self.assertEqual(resp.status_code, 403)

        # Pastikan lock belum dibuat
        self.assertFalse(
            KunciAbsensi.objects.filter(
                kelas=self.kelas, date="2026-03-21"
            ).exists()
        )


# ===================================================================
# 4. Konsistensi multi-user (conflict detection)
# ===================================================================

@override_settings(DEBUG=True)
class MultiUserConflictConsistencyTest(TestCase):
    """Memastikan mekanisme deteksi conflict bekerja dengan benar."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        api.throttle = []

    def setUp(self):
        self.client = Client()

        self.wali = User.objects.create_user(
            username="wali_c", password="pw", full_name="Wali C", type="wali_kelas",
        )
        self.wali.token = "walictoken"
        self.wali.save()

        self.sekretaris = User.objects.create_user(
            username="sek_c", password="pw", full_name="Sek C", type="sekretaris",
        )
        self.sekretaris.token = "sekctoken"
        self.sekretaris.save()

        self.kelas = Kelas.objects.create(name="Conflict-Kelas", active=True, wali_kelas=self.wali)
        self.kelas.sekretaris.add(self.sekretaris)
        self.siswa = Siswa.objects.create(fullname="Siswa Conflict", kelas=self.kelas)
        self.date_str = "21-03-26"

    def _upload(self, payloads, token):
        return self.client.post(
            "/api/upload",
            data={"data": payloads},
            content_type="application/json",
            headers={"Authorization": f"Bearer {token}"},
        )

    def test_different_user_different_status_generates_conflict(self):
        """
        Jika user A mengabsen "hadir" lalu user B mengabsen "sakit"
        (tanpa previous_status), harus menghasilkan conflict.
        """
        # User A (wali) absen hadir
        self._upload(
            [_make_upload_payload(self.siswa.pk, self.date_str, "hadir")],
            token="walictoken",
        )

        # User B (sekretaris) absen sakit tanpa previous_status → conflict
        resp = self._upload(
            [_make_upload_payload(self.siswa.pk, self.date_str, "sakit")],
            token="sekctoken",
        )
        self.assertEqual(resp.status_code, 200)
        conflicts = resp.json()["data"]["conflicts"]
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(conflicts[0]["other"]["absensi_status"], "hadir")
        self.assertEqual(conflicts[0]["self"]["absensi_status"], "sakit")

        # Data di DB harus tetap "hadir" (tidak berubah karena conflict)
        absensi = Absensi.objects.get(siswa=self.siswa, date="2026-03-21")
        self.assertEqual(absensi._status, "hadir")

    def test_resolve_conflict_with_previous_status(self):
        """
        Jika user B mengirim previous_status yang sesuai, maka update
        harus berhasil tanpa conflict.
        """
        # User A absen hadir
        self._upload(
            [_make_upload_payload(self.siswa.pk, self.date_str, "hadir")],
            token="walictoken",
        )

        # User B resolve conflict: previous_status=hadir → sakit
        resp = self._upload(
            [_make_upload_payload(self.siswa.pk, self.date_str, "sakit",
                                  previous_status="hadir")],
            token="sekctoken",
        )
        self.assertEqual(resp.status_code, 200)
        conflicts = resp.json()["data"]["conflicts"]
        self.assertEqual(len(conflicts), 0)

        # Data harus berubah ke "sakit"
        absensi = Absensi.objects.get(siswa=self.siswa, date="2026-03-21")
        self.assertEqual(absensi._status, "sakit")

    def test_stale_previous_status_generates_conflict(self):
        """
        User B mengirim previous_status yang sudah basi (tidak sesuai
        status terkini di DB). Harus menghasilkan conflict.
        """
        # User A absen hadir
        self._upload(
            [_make_upload_payload(self.siswa.pk, self.date_str, "hadir")],
            token="walictoken",
        )
        # User A update ke izin (user sama, langsung overwrite)
        self._upload(
            [_make_upload_payload(self.siswa.pk, self.date_str, "izin")],
            token="walictoken",
        )

        # User B kirim previous_status=hadir (basi, sekarang DB=izin) → conflict
        resp = self._upload(
            [_make_upload_payload(self.siswa.pk, self.date_str, "sakit",
                                  previous_status="hadir")],
            token="sekctoken",
        )
        self.assertEqual(resp.status_code, 200)
        conflicts = resp.json()["data"]["conflicts"]
        self.assertEqual(len(conflicts), 1)

        # Data tetap "izin"
        absensi = Absensi.objects.get(siswa=self.siswa, date="2026-03-21")
        self.assertEqual(absensi._status, "izin")


# ===================================================================
# 5. Konsistensi cross-endpoint (absensi vs progress)
# ===================================================================

@override_settings(DEBUG=True)
class CrossEndpointConsistencyTest(TestCase):
    """
    Memastikan data antara endpoint GET /absensi dan GET /absensi/progress
    selalu konsisten satu sama lain.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        api.throttle = []

    def setUp(self):
        self.client = Client()

        self.user = User.objects.create_user(
            username="cross_user", password="pw",
            full_name="Cross User", type="kesiswaan",
        )
        self.user.token = "crosstoken"
        self.user.save()

        self.kelas = Kelas.objects.create(name="Cross-Kelas", active=True)
        self.siswas = [
            Siswa.objects.create(fullname=f"Siswa-{i}", kelas=self.kelas)
            for i in range(5)
        ]
        self.today = timezone.now().date()
        self.date_iso = self.today.isoformat()

    def test_absensi_detail_matches_progress_stats(self):
        """
        Jumlah siswa yang tidak masuk dari /absensi harus sesuai
        dengan total_tidak_masuk dari /absensi/progress.
        """
        statuses = ["hadir", "sakit", "hadir", "alfa", "hadir"]
        for siswa, status in zip(self.siswas, statuses):
            Absensi.objects.create(
                date=self.today, siswa=siswa, _status=status, by=self.user,
            )

        # GET /absensi
        resp_detail = self.client.get(
            f"/api/absensi?date={self.date_iso}&kelas_id={self.kelas.pk}",
            headers={"Authorization": "Bearer crosstoken"},
        )
        detail_data = resp_detail.json()["data"]
        count_tidak_masuk_detail = sum(
            1 for v in detail_data.values() if v != "hadir"
        )

        # GET /absensi/progress
        resp_progress = self.client.get(
            f"/api/absensi/progress?kelas_id={self.kelas.pk}&dates={self.date_iso}",
            headers={"Authorization": "Bearer crosstoken"},
        )
        progress_data = resp_progress.json()["data"][self.date_iso]

        # Harus sama
        self.assertEqual(count_tidak_masuk_detail, progress_data["total_tidak_masuk"])

        # is_complete harus True karena semua 5 siswa sudah diabsen
        total_siswa = len(self.siswas)
        total_diabsen = len(detail_data)
        self.assertEqual(total_siswa, total_diabsen)
        self.assertTrue(progress_data["is_complete"])

    def test_no_absensi_means_all_null_and_incomplete(self):
        """
        Jika belum ada absensi, /absensi harus memberi None untuk semua
        siswa dan /absensi/progress harus is_complete=False.
        """
        resp_detail = self.client.get(
            f"/api/absensi?date={self.date_iso}&kelas_id={self.kelas.pk}",
            headers={"Authorization": "Bearer crosstoken"},
        )
        detail_data = resp_detail.json()["data"]

        for siswa in self.siswas:
            self.assertIsNone(detail_data[str(siswa.pk)])

        resp_progress = self.client.get(
            f"/api/absensi/progress?kelas_id={self.kelas.pk}&dates={self.date_iso}",
            headers={"Authorization": "Bearer crosstoken"},
        )
        progress = resp_progress.json()["data"][self.date_iso]
        self.assertFalse(progress["is_complete"])
        self.assertEqual(progress["total_tidak_masuk"], 0)


# ===================================================================
# 6. Konsistensi data piket upload (round-trip)
# ===================================================================

@override_settings(DEBUG=True)
class PiketUploadConsistencyTest(TestCase):
    """
    Memastikan flow piket (masuk → tunggu → pulang → hadir) menjaga
    konsistensi data.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        api.throttle = []

    def setUp(self):
        self.client = Client()

        self.guru_piket = User.objects.create_user(
            username="piket_c", password="pw",
            full_name="Guru Piket C", type="guru_piket",
        )
        self.guru_piket.token = "piketctoken"
        self.guru_piket.save()

        self.kesiswaan = User.objects.create_user(
            username="kesiswaan_c", password="pw",
            full_name="Kesiswaan C", type="kesiswaan",
        )
        self.kesiswaan.token = "kesiswaanctoken"
        self.kesiswaan.save()

        self.kelas = Kelas.objects.create(name="Piket-Kelas", active=True)
        self.siswa = Siswa.objects.create(fullname="Siswa Piket", kelas=self.kelas)

        # Mock Monday 2026-03-23
        self.mock_now = datetime(2026, 3, 23, 8, 0, 0, tzinfo=settings.TIME_ZONE_OBJ)

        self.session = AbsensiSession.objects.create(
            jam_masuk="07:00:00", jam_keluar="14:00:00", senin=True,
        )
        self.session.kelas.add(self.kelas)

    @patch("django.utils.timezone.now")
    @patch("main.helpers.redis.get_singleton_client")
    def test_piket_masuk_pulang_roundtrip(self, mock_redis, mock_tz):
        """
        Flow piket: masuk creates tunggu → pulang updates to hadir.
        Verify via GET /absensi.
        """
        mock_tz.return_value = self.mock_now
        mock_redis_client = MagicMock()
        mock_redis_client.get.return_value = None
        mock_redis.return_value = mock_redis_client

        ts = int(self.mock_now.timestamp())

        # Absen masuk
        self.client.post(
            "/api/piket/upload",
            data=[{"siswa": self.siswa.pk, "timestamp": ts, "type": "absen_masuk"}],
            content_type="application/json",
            headers={"Authorization": "Bearer piketctoken"},
            HTTP_HOST="testserver",
        )

        # Verify: status harus "tunggu" di DB
        absensi = Absensi.objects.get(siswa=self.siswa, date=self.mock_now.date())
        self.assertEqual(absensi._status, "tunggu")
        self.assertIsNotNone(absensi.wait_expired_at)

        # Absen pulang
        self.client.post(
            "/api/piket/upload",
            data=[{"siswa": self.siswa.pk, "timestamp": ts, "type": "absen_pulang"}],
            content_type="application/json",
            headers={"Authorization": "Bearer piketctoken"},
            HTTP_HOST="testserver",
        )

        # Verify: status harus "hadir"
        absensi.refresh_from_db()
        self.assertEqual(absensi._status, "hadir")

    @patch("django.utils.timezone.now")
    @patch("main.helpers.redis.get_singleton_client")
    def test_piket_pulang_tanpa_masuk_tidak_buat_record(self, mock_redis, mock_tz):
        """
        Absen pulang tanpa absen masuk sebelumnya tidak boleh
        membuat record absensi baru.
        """
        mock_tz.return_value = self.mock_now
        mock_redis_client = MagicMock()
        mock_redis_client.get.return_value = None
        mock_redis.return_value = mock_redis_client

        ts = int(self.mock_now.timestamp())

        resp = self.client.post(
            "/api/piket/upload",
            data=[{"siswa": self.siswa.pk, "timestamp": ts, "type": "absen_pulang"}],
            content_type="application/json",
            headers={"Authorization": "Bearer piketctoken"},
            HTTP_HOST="testserver",
        )
        self.assertEqual(resp.status_code, 200)

        # Tidak ada record absensi yang dibuat
        self.assertFalse(
            Absensi.objects.filter(siswa=self.siswa, date=self.mock_now.date()).exists()
        )


# ===================================================================
# 7. Konsistensi multi-date progress
# ===================================================================

@override_settings(DEBUG=True)
class MultiDateProgressConsistencyTest(TestCase):
    """
    Memastikan GET /absensi/progress mengembalikan data yang akurat
    untuk beberapa tanggal sekaligus.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        api.throttle = []

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username="multidate", password="pw",
            full_name="Multi Date", type="kesiswaan",
        )
        self.user.token = "multidatetoken"
        self.user.save()

        self.kelas = Kelas.objects.create(name="Multi-Date-Kelas", active=True)
        self.siswa1 = Siswa.objects.create(fullname="MD-1", kelas=self.kelas)
        self.siswa2 = Siswa.objects.create(fullname="MD-2", kelas=self.kelas)

    def test_multi_date_progress_each_date_independent(self):
        """Setiap tanggal harus memiliki statistik independen."""
        date1 = timezone.now().date()
        date2 = date1 - timedelta(days=1)

        # date1: siswa1 hadir, siswa2 belum
        Absensi.objects.create(
            date=date1, siswa=self.siswa1, _status="hadir", by=self.user,
        )

        # date2: siswa1 hadir, siswa2 sakit
        Absensi.objects.create(
            date=date2, siswa=self.siswa1, _status="hadir", by=self.user,
        )
        Absensi.objects.create(
            date=date2, siswa=self.siswa2, _status="sakit", by=self.user,
        )

        dates_str = f"{date1.isoformat()},{date2.isoformat()}"
        resp = self.client.get(
            f"/api/absensi/progress?kelas_id={self.kelas.pk}&dates={dates_str}",
            headers={"Authorization": "Bearer multidatetoken"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()["data"]

        # date1: 1/2 → incomplete, 0 tidak masuk
        self.assertFalse(data[date1.isoformat()]["is_complete"])
        self.assertEqual(data[date1.isoformat()]["total_tidak_masuk"], 0)

        # date2: 2/2 → complete, 1 tidak masuk (sakit)
        self.assertTrue(data[date2.isoformat()]["is_complete"])
        self.assertEqual(data[date2.isoformat()]["total_tidak_masuk"], 1)


# ===================================================================
# 8. Konsistensi akses data berdasarkan role
# ===================================================================

@override_settings(DEBUG=True)
class RoleBasedAccessConsistencyTest(TestCase):
    """
    Memastikan setiap role hanya bisa mengakses data yang sesuai
    dan data yang dikembalikan konsisten.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        api.throttle = []

    def setUp(self):
        self.client = Client()

        # Wali kelas A
        self.wali_a = User.objects.create_user(
            username="wali_a", password="pw", full_name="Wali A", type="wali_kelas",
        )
        self.wali_a.token = "waliatoken"
        self.wali_a.save()

        # Wali kelas B
        self.wali_b = User.objects.create_user(
            username="wali_b", password="pw", full_name="Wali B", type="wali_kelas",
        )
        self.wali_b.token = "walibtoken"
        self.wali_b.save()

        self.kelas_a = Kelas.objects.create(name="X-IPA-1", active=True, wali_kelas=self.wali_a)
        self.kelas_b = Kelas.objects.create(name="X-IPA-2", active=True, wali_kelas=self.wali_b)

        self.siswa_a = Siswa.objects.create(fullname="Siswa A", kelas=self.kelas_a)
        self.siswa_b = Siswa.objects.create(fullname="Siswa B", kelas=self.kelas_b)

        self.today = timezone.now().date()

    def test_wali_kelas_cannot_see_other_kelas(self):
        """Wali kelas A tidak bisa melihat absensi kelas B."""
        resp = self.client.get(
            f"/api/absensi?date={self.today.isoformat()}&kelas_id={self.kelas_b.pk}",
            headers={"Authorization": "Bearer waliatoken"},
        )
        self.assertEqual(resp.status_code, 404)

    def test_wali_kelas_can_see_own_kelas(self):
        """Wali kelas A bisa melihat absensi kelas A."""
        resp = self.client.get(
            f"/api/absensi?date={self.today.isoformat()}&kelas_id={self.kelas_a.pk}",
            headers={"Authorization": "Bearer waliatoken"},
        )
        self.assertEqual(resp.status_code, 200)

    def test_wali_upload_other_kelas_skipped(self):
        """
        Wali kelas A mencoba upload absensi untuk siswa kelas B
        → harus diskip (bukan error, tapi data tidak ditulis).
        """
        payload = _make_upload_payload(self.siswa_b.pk, self.today.strftime("%d-%m-%y"), "hadir")
        resp = self.client.post(
            "/api/upload",
            data={"data": [payload]},
            content_type="application/json",
            headers={"Authorization": "Bearer waliatoken"},
        )
        self.assertEqual(resp.status_code, 200)

        # Data siswa B tidak boleh ada
        self.assertFalse(
            Absensi.objects.filter(siswa=self.siswa_b, date=self.today).exists()
        )

    def test_me_endpoint_returns_correct_kelas(self):
        """Endpoint /me harus mengembalikan kelas sesuai role user."""
        resp_a = self.client.get(
            "/api/me", headers={"Authorization": "Bearer waliatoken"},
        )
        self.assertEqual(resp_a.json()["data"]["kelas"], self.kelas_a.pk)

        resp_b = self.client.get(
            "/api/me", headers={"Authorization": "Bearer walibtoken"},
        )
        self.assertEqual(resp_b.json()["data"]["kelas"], self.kelas_b.pk)
