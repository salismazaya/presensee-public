"""
Test untuk endpoint GET /api/data (dump_data).

Endpoint ini mengembalikan SQL dump (text/plain) berisi tabel
kelas, siswa, absensi, dan kunci_absensi yang sudah difilter
berdasarkan role user yang sedang login.
"""

import sqlite3
from datetime import timedelta

from django.test import Client, TestCase, override_settings
from django.utils import timezone

from main.api.api import api
from main.models import Absensi, Kelas, KunciAbsensi, Siswa, User


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_dump_to_db(sql_text: str) -> sqlite3.Connection:
    """Parse SQL dump string dan eksekusi ke in-memory SQLite, return connection."""
    conn = sqlite3.connect(":memory:")
    conn.executescript(sql_text)
    return conn


def _count_rows(conn: sqlite3.Connection, table: str) -> int:
    return conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


def _get_all(conn: sqlite3.Connection, table: str) -> list[tuple]:
    return conn.execute(f"SELECT * FROM {table}").fetchall()


def _get_column_values(conn: sqlite3.Connection, table: str, column: str) -> list:
    return [row[0] for row in conn.execute(f"SELECT {column} FROM {table}").fetchall()]


# ===================================================================
# 1. Dump data untuk role Kesiswaan (bisa lihat semua kelas aktif)
# ===================================================================

@override_settings(DEBUG=True)
class DumpDataKesiswaanTest(TestCase):
    """Kesiswaan harus bisa melihat data semua kelas aktif."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        api.throttle = []

    def setUp(self):
        self.client = Client()

        self.kesiswaan = User.objects.create_user(
            username="kesiswaan_dump", password="pw",
            full_name="Kesiswaan Dump", type="kesiswaan",
        )
        self.kesiswaan.token = "kesiswaandumptoken"
        self.kesiswaan.save()

        self.kelas_a = Kelas.objects.create(name="XII-IPA-1", active=True)
        self.kelas_b = Kelas.objects.create(name="XII-IPA-2", active=True)
        self.kelas_inactive = Kelas.objects.create(name="XII-IPA-OLD", active=False)

        self.siswa_a1 = Siswa.objects.create(fullname="Andi", kelas=self.kelas_a)
        self.siswa_a2 = Siswa.objects.create(fullname="Budi", kelas=self.kelas_a)
        self.siswa_b1 = Siswa.objects.create(fullname="Cici", kelas=self.kelas_b)
        self.siswa_inactive = Siswa.objects.create(
            fullname="Dodo", kelas=self.kelas_inactive,
        )

        self.today = timezone.now().date()
        self.absensi_a1 = Absensi.objects.create(
            date=self.today, siswa=self.siswa_a1,
            _status="hadir", by=self.kesiswaan,
        )
        self.absensi_b1 = Absensi.objects.create(
            date=self.today, siswa=self.siswa_b1,
            _status="sakit", by=self.kesiswaan,
        )
        # Absensi untuk kelas inactive — tidak boleh masuk dump
        self.absensi_inactive = Absensi.objects.create(
            date=self.today, siswa=self.siswa_inactive,
            _status="hadir", by=self.kesiswaan,
        )

        KunciAbsensi.objects.create(
            kelas=self.kelas_a, date=self.today, locked=True,
        )

    def _get_dump(self, token="kesiswaandumptoken"):
        return self.client.get(
            "/api/data",
            headers={"Authorization": f"Bearer {token}"},
        )

    def test_response_ok_and_text_plain(self):
        """Endpoint harus return 200 dengan content-type text/plain."""
        resp = self._get_dump()
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/plain", resp["Content-Type"])

    def test_sql_dump_is_valid_and_executable(self):
        """SQL dump harus valid dan bisa dieksekusi di SQLite."""
        resp = self._get_dump()
        conn = _parse_dump_to_db(resp.content.decode())
        # Semua tabel harus ada
        tables = [
            row[0] for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        ]
        for expected in ["kelas", "siswa", "absensi", "kunci_absensi"]:
            self.assertIn(expected, tables)
        conn.close()

    def test_kesiswaan_sees_all_active_kelas(self):
        """Kesiswaan harus bisa lihat semua kelas yang aktif saja."""
        resp = self._get_dump()
        conn = _parse_dump_to_db(resp.content.decode())

        kelas_names = _get_column_values(conn, "kelas", "name")
        self.assertIn("XII-IPA-1", kelas_names)
        self.assertIn("XII-IPA-2", kelas_names)
        self.assertNotIn("XII-IPA-OLD", kelas_names)

        self.assertEqual(_count_rows(conn, "kelas"), 2)
        conn.close()

    def test_kesiswaan_sees_siswa_of_active_kelas_only(self):
        """Siswa dari kelas tidak aktif tidak boleh masuk dump."""
        resp = self._get_dump()
        conn = _parse_dump_to_db(resp.content.decode())

        siswa_names = _get_column_values(conn, "siswa", "fullname")
        self.assertIn("Andi", siswa_names)
        self.assertIn("Budi", siswa_names)
        self.assertIn("Cici", siswa_names)
        self.assertNotIn("Dodo", siswa_names)

        self.assertEqual(_count_rows(conn, "siswa"), 3)
        conn.close()

    def test_kesiswaan_sees_absensi_of_active_kelas_only(self):
        """Absensi dari kelas tidak aktif tidak boleh masuk dump."""
        resp = self._get_dump()
        conn = _parse_dump_to_db(resp.content.decode())

        self.assertEqual(_count_rows(conn, "absensi"), 2)

        siswa_ids_in_dump = _get_column_values(conn, "absensi", "siswa_id")
        self.assertIn(self.siswa_a1.pk, siswa_ids_in_dump)
        self.assertIn(self.siswa_b1.pk, siswa_ids_in_dump)
        self.assertNotIn(self.siswa_inactive.pk, siswa_ids_in_dump)
        conn.close()

    def test_kesiswaan_sees_lock_of_active_kelas_only(self):
        """Kunci absensi hanya untuk kelas aktif."""
        resp = self._get_dump()
        conn = _parse_dump_to_db(resp.content.decode())

        self.assertEqual(_count_rows(conn, "kunci_absensi"), 1)
        conn.close()

    def test_absensi_status_consistent_with_db(self):
        """Status absensi di dump harus sesuai status di Django DB."""
        resp = self._get_dump()
        conn = _parse_dump_to_db(resp.content.decode())

        rows = conn.execute(
            "SELECT siswa_id, status FROM absensi ORDER BY siswa_id"
        ).fetchall()
        dump_map = {row[0]: row[1] for row in rows}

        self.assertEqual(dump_map[self.siswa_a1.pk], "hadir")
        self.assertEqual(dump_map[self.siswa_b1.pk], "sakit")
        conn.close()

    def test_siswa_kelas_id_references_valid_kelas(self):
        """Setiap siswa.kelas_id di dump harus mereferensi kelas yang ada."""
        resp = self._get_dump()
        conn = _parse_dump_to_db(resp.content.decode())

        kelas_ids = set(_get_column_values(conn, "kelas", "id"))
        siswa_kelas_ids = set(_get_column_values(conn, "siswa", "kelas_id"))

        self.assertTrue(
            siswa_kelas_ids.issubset(kelas_ids),
            f"siswa.kelas_id {siswa_kelas_ids - kelas_ids} tidak ada di tabel kelas",
        )
        conn.close()

    def test_absensi_siswa_id_references_valid_siswa(self):
        """Setiap absensi.siswa_id di dump harus mereferensi siswa yang ada."""
        resp = self._get_dump()
        conn = _parse_dump_to_db(resp.content.decode())

        siswa_ids = set(_get_column_values(conn, "siswa", "id"))
        absensi_siswa_ids = set(_get_column_values(conn, "absensi", "siswa_id"))

        self.assertTrue(
            absensi_siswa_ids.issubset(siswa_ids),
            f"absensi.siswa_id {absensi_siswa_ids - siswa_ids} tidak ada di tabel siswa",
        )
        conn.close()


# ===================================================================
# 2. Dump data untuk role Wali Kelas (hanya kelas sendiri)
# ===================================================================

@override_settings(DEBUG=True)
class DumpDataWaliKelasTest(TestCase):
    """Wali kelas hanya bisa lihat data kelas yang dia pegang."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        api.throttle = []

    def setUp(self):
        self.client = Client()

        self.wali_a = User.objects.create_user(
            username="wali_dump_a", password="pw",
            full_name="Wali Dump A", type="wali_kelas",
        )
        self.wali_a.token = "walidumpatoken"
        self.wali_a.save()

        self.wali_b = User.objects.create_user(
            username="wali_dump_b", password="pw",
            full_name="Wali Dump B", type="wali_kelas",
        )
        self.wali_b.token = "walidumpbtoken"
        self.wali_b.save()

        self.kelas_a = Kelas.objects.create(
            name="XI-A", active=True, wali_kelas=self.wali_a,
        )
        self.kelas_b = Kelas.objects.create(
            name="XI-B", active=True, wali_kelas=self.wali_b,
        )

        self.siswa_a = Siswa.objects.create(fullname="Siswa-A", kelas=self.kelas_a)
        self.siswa_b = Siswa.objects.create(fullname="Siswa-B", kelas=self.kelas_b)

        self.today = timezone.now().date()
        Absensi.objects.create(
            date=self.today, siswa=self.siswa_a,
            _status="hadir", by=self.wali_a,
        )
        Absensi.objects.create(
            date=self.today, siswa=self.siswa_b,
            _status="izin", by=self.wali_b,
        )

    def test_wali_a_only_sees_own_kelas(self):
        """Wali A hanya melihat kelas A, bukan kelas B."""
        resp = self.client.get(
            "/api/data",
            headers={"Authorization": "Bearer walidumpatoken"},
        )
        conn = _parse_dump_to_db(resp.content.decode())

        kelas_names = _get_column_values(conn, "kelas", "name")
        self.assertEqual(kelas_names, ["XI-A"])

        siswa_names = _get_column_values(conn, "siswa", "fullname")
        self.assertEqual(siswa_names, ["Siswa-A"])

        self.assertEqual(_count_rows(conn, "absensi"), 1)
        conn.close()

    def test_wali_b_only_sees_own_kelas(self):
        """Wali B hanya melihat kelas B, bukan kelas A."""
        resp = self.client.get(
            "/api/data",
            headers={"Authorization": "Bearer walidumpbtoken"},
        )
        conn = _parse_dump_to_db(resp.content.decode())

        kelas_names = _get_column_values(conn, "kelas", "name")
        self.assertEqual(kelas_names, ["XI-B"])

        siswa_names = _get_column_values(conn, "siswa", "fullname")
        self.assertEqual(siswa_names, ["Siswa-B"])

        self.assertEqual(_count_rows(conn, "absensi"), 1)
        absensi_status = _get_column_values(conn, "absensi", "status")
        self.assertEqual(absensi_status, ["izin"])
        conn.close()

    def test_wali_dump_fk_integrity(self):
        """FK integrity tetap terjaga walaupun data difilter."""
        resp = self.client.get(
            "/api/data",
            headers={"Authorization": "Bearer walidumpatoken"},
        )
        conn = _parse_dump_to_db(resp.content.decode())

        kelas_ids = set(_get_column_values(conn, "kelas", "id"))
        siswa_kelas_ids = set(_get_column_values(conn, "siswa", "kelas_id"))
        absensi_siswa_ids = set(_get_column_values(conn, "absensi", "siswa_id"))
        siswa_ids = set(_get_column_values(conn, "siswa", "id"))

        self.assertTrue(siswa_kelas_ids.issubset(kelas_ids))
        self.assertTrue(absensi_siswa_ids.issubset(siswa_ids))
        conn.close()


# ===================================================================
# 3. Dump data untuk role Sekretaris
# ===================================================================

@override_settings(DEBUG=True)
class DumpDataSekretarisTest(TestCase):
    """Sekretaris hanya bisa lihat data kelas yang dia ditugaskan."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        api.throttle = []

    def setUp(self):
        self.client = Client()

        self.sekretaris = User.objects.create_user(
            username="sek_dump", password="pw",
            full_name="Sek Dump", type="sekretaris",
        )
        self.sekretaris.token = "sekdumptoken"
        self.sekretaris.save()

        self.kelas_assigned = Kelas.objects.create(name="X-1", active=True)
        self.kelas_assigned.sekretaris.add(self.sekretaris)

        self.kelas_other = Kelas.objects.create(name="X-2", active=True)

        self.siswa_assigned = Siswa.objects.create(
            fullname="Siswa Sek", kelas=self.kelas_assigned,
        )
        self.siswa_other = Siswa.objects.create(
            fullname="Siswa Lain", kelas=self.kelas_other,
        )

        self.today = timezone.now().date()
        Absensi.objects.create(
            date=self.today, siswa=self.siswa_assigned,
            _status="hadir", by=self.sekretaris,
        )
        Absensi.objects.create(
            date=self.today, siswa=self.siswa_other,
            _status="alfa", by=self.sekretaris,
        )

    def test_sekretaris_only_sees_assigned_kelas(self):
        """Sekretaris hanya melihat data kelas yang ditugaskan."""
        resp = self.client.get(
            "/api/data",
            headers={"Authorization": "Bearer sekdumptoken"},
        )
        conn = _parse_dump_to_db(resp.content.decode())

        kelas_names = _get_column_values(conn, "kelas", "name")
        self.assertEqual(kelas_names, ["X-1"])

        siswa_names = _get_column_values(conn, "siswa", "fullname")
        self.assertEqual(siswa_names, ["Siswa Sek"])

        self.assertEqual(_count_rows(conn, "absensi"), 1)
        conn.close()

    def test_sekretaris_dump_fk_integrity(self):
        """FK integrity tetap terjaga pada dump sekretaris."""
        resp = self.client.get(
            "/api/data",
            headers={"Authorization": "Bearer sekdumptoken"},
        )
        conn = _parse_dump_to_db(resp.content.decode())

        kelas_ids = set(_get_column_values(conn, "kelas", "id"))
        siswa_kelas_ids = set(_get_column_values(conn, "siswa", "kelas_id"))
        absensi_siswa_ids = set(_get_column_values(conn, "absensi", "siswa_id"))
        siswa_ids = set(_get_column_values(conn, "siswa", "id"))

        self.assertTrue(siswa_kelas_ids.issubset(kelas_ids))
        self.assertTrue(absensi_siswa_ids.issubset(siswa_ids))
        conn.close()


# ===================================================================
# 4. Dump data untuk role lain (guru_piket) → empty
# ===================================================================

@override_settings(DEBUG=True)
class DumpDataOtherRoleTest(TestCase):
    """Role selain kesiswaan/wali/sekretaris harus mendapat data kosong."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        api.throttle = []

    def setUp(self):
        self.client = Client()

        self.guru_piket = User.objects.create_user(
            username="piket_dump", password="pw",
            full_name="Piket Dump", type="guru_piket",
        )
        self.guru_piket.token = "piketdumptoken"
        self.guru_piket.save()

        self.kelas = Kelas.objects.create(name="Piket-K", active=True)
        Siswa.objects.create(fullname="Siswa P", kelas=self.kelas)

    def test_guru_piket_gets_empty_dump(self):
        """Guru piket seharusnya tidak mendapat data kelas/siswa/absensi."""
        resp = self.client.get(
            "/api/data",
            headers={"Authorization": "Bearer piketdumptoken"},
        )
        self.assertEqual(resp.status_code, 200)

        conn = _parse_dump_to_db(resp.content.decode())

        self.assertEqual(_count_rows(conn, "kelas"), 0)
        self.assertEqual(_count_rows(conn, "siswa"), 0)
        self.assertEqual(_count_rows(conn, "absensi"), 0)
        conn.close()


# ===================================================================
# 5. Dump data — edge cases
# ===================================================================

@override_settings(DEBUG=True)
class DumpDataEdgeCasesTest(TestCase):
    """Edge case: empty data, banyak absensi, lock filter."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        api.throttle = []

    def setUp(self):
        self.client = Client()

        self.kesiswaan = User.objects.create_user(
            username="kesiswaan_edge", password="pw",
            full_name="Kesiswaan Edge", type="kesiswaan",
        )
        self.kesiswaan.token = "edgetoken"
        self.kesiswaan.save()

    def test_empty_database_returns_valid_dump(self):
        """Dump tanpa data apapun harus tetap SQL yang valid."""
        resp = self.client.get(
            "/api/data",
            headers={"Authorization": "Bearer edgetoken"},
        )
        self.assertEqual(resp.status_code, 200)

        conn = _parse_dump_to_db(resp.content.decode())
        self.assertEqual(_count_rows(conn, "kelas"), 0)
        self.assertEqual(_count_rows(conn, "siswa"), 0)
        self.assertEqual(_count_rows(conn, "absensi"), 0)
        self.assertEqual(_count_rows(conn, "kunci_absensi"), 0)
        conn.close()

    def test_multiple_absensi_dates(self):
        """Dump harus berisi absensi dari berbagai tanggal."""
        kelas = Kelas.objects.create(name="Edge-K", active=True)
        siswa = Siswa.objects.create(fullname="Edge-S", kelas=kelas)

        today = timezone.now().date()
        for i in range(5):
            Absensi.objects.create(
                date=today - timedelta(days=i), siswa=siswa,
                _status="hadir", by=self.kesiswaan,
            )

        resp = self.client.get(
            "/api/data",
            headers={"Authorization": "Bearer edgetoken"},
        )
        conn = _parse_dump_to_db(resp.content.decode())

        self.assertEqual(_count_rows(conn, "absensi"), 5)
        conn.close()

    def test_locked_only_shows_locked_true(self):
        """Kunci absensi di dump harus hanya yang locked=True."""
        kelas = Kelas.objects.create(name="Lock-Edge-K", active=True)

        today = timezone.now().date()
        yesterday = today - timedelta(days=1)

        KunciAbsensi.objects.create(kelas=kelas, date=today, locked=True)
        KunciAbsensi.objects.create(kelas=kelas, date=yesterday, locked=False)

        resp = self.client.get(
            "/api/data",
            headers={"Authorization": "Bearer edgetoken"},
        )
        conn = _parse_dump_to_db(resp.content.decode())

        # Hanya lock yang locked=True yang masuk dump
        self.assertEqual(_count_rows(conn, "kunci_absensi"), 1)
        conn.close()

    def test_absensi_unique_date_siswa_in_dump(self):
        """Tidak boleh ada duplikat (date, siswa_id) di tabel absensi dump."""
        kelas = Kelas.objects.create(name="Uniq-K", active=True)
        siswa1 = Siswa.objects.create(fullname="Uniq-1", kelas=kelas)
        siswa2 = Siswa.objects.create(fullname="Uniq-2", kelas=kelas)

        today = timezone.now().date()
        Absensi.objects.create(
            date=today, siswa=siswa1, _status="hadir", by=self.kesiswaan,
        )
        Absensi.objects.create(
            date=today, siswa=siswa2, _status="sakit", by=self.kesiswaan,
        )

        resp = self.client.get(
            "/api/data",
            headers={"Authorization": "Bearer edgetoken"},
        )
        conn = _parse_dump_to_db(resp.content.decode())

        # Cek unique constraint di dump
        rows = conn.execute(
            "SELECT date, siswa_id, COUNT(*) as cnt "
            "FROM absensi GROUP BY date, siswa_id HAVING cnt > 1"
        ).fetchall()
        self.assertEqual(len(rows), 0, "Ada duplikat (date, siswa_id) di dump!")
        conn.close()

    def test_many_siswa_consistency(self):
        """Dump dengan banyak siswa harus konsisten jumlahnya."""
        kelas = Kelas.objects.create(name="Many-K", active=True)
        expected_count = 50
        for i in range(expected_count):
            Siswa.objects.create(fullname=f"Siswa-{i}", kelas=kelas)

        resp = self.client.get(
            "/api/data",
            headers={"Authorization": "Bearer edgetoken"},
        )
        conn = _parse_dump_to_db(resp.content.decode())

        self.assertEqual(_count_rows(conn, "siswa"), expected_count)
        self.assertEqual(_count_rows(conn, "kelas"), 1)
        conn.close()
