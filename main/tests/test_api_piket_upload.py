from datetime import datetime
from unittest.mock import MagicMock, patch
from django.test import TestCase, Client, override_settings
from django.conf import settings
from main.models import User, Kelas, Siswa, AbsensiSession, Absensi
from main.api.api import api


@override_settings(DEBUG=True)
class PiketUploadApiTest(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        api.throttle = []

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username="testuser",
            password="testpassword",
            full_name="Test User",
            type="guru_piket",
        )
        self.user.token = "testtoken"
        self.user.save()

        self.kelas = Kelas.objects.create(name="Kelas 10-A", active=True)
        self.siswa = Siswa.objects.create(fullname="Siswa 1", kelas=self.kelas)

        # Mock Monday 2026-03-23
        self.mock_now = datetime(2026, 3, 23, 8, 0, 0, tzinfo=settings.TIME_ZONE_OBJ)

        # Create AbsensiSession for Monday (senin)
        self.session = AbsensiSession.objects.create(
            jam_masuk="07:00:00", jam_keluar="14:00:00", senin=True
        )
        self.session.kelas.add(self.kelas)

    @patch("django.utils.timezone.now")
    @patch("main.helpers.redis.get_singleton_client")
    def test_piket_upload_masuk_success(self, mock_redis, mock_timezone_now):
        mock_timezone_now.return_value = self.mock_now

        mock_redis_client = MagicMock()
        mock_redis_client.get.return_value = None
        mock_redis.return_value = mock_redis_client

        timestamp = int(self.mock_now.timestamp())
        data = [{"siswa": self.siswa.pk, "timestamp": timestamp, "type": "absen_masuk"}]

        response = self.client.post(
            "/api/piket/upload",
            data=data,
            content_type="application/json",
            headers={"Authorization": "Bearer testtoken"},
            HTTP_HOST="testserver",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"data": {"invalids": []}})

        # Verify Absensi created
        self.assertTrue(
            Absensi.objects.filter(
                siswa=self.siswa, _status=Absensi.StatusChoices.WAIT
            ).exists()
        )

    @patch("django.utils.timezone.now")
    @patch("main.helpers.redis.get_singleton_client")
    def test_piket_upload_pulang_success(self, mock_redis, mock_timezone_now):
        mock_timezone_now.return_value = self.mock_now

        mock_redis_client = MagicMock()
        mock_redis_client.get.return_value = None
        mock_redis.return_value = mock_redis_client

        # Create "masuk" record first
        date = self.mock_now.date()
        Absensi.objects.create(
            date=date,
            siswa=self.siswa,
            _status=Absensi.StatusChoices.WAIT,
            by=self.user,
            wait_expired_at=self.mock_now,  # Just use mock_now as dummy
        )

        # Use the same date for the "pulang" upload
        timestamp = int(self.mock_now.timestamp())
        data = [
            {"siswa": self.siswa.pk, "timestamp": timestamp, "type": "absen_pulang"}
        ]

        response = self.client.post(
            "/api/piket/upload",
            data=data,
            content_type="application/json",
            headers={"Authorization": "Bearer testtoken"},
            HTTP_HOST="testserver",
        )

        self.assertEqual(response.status_code, 200)

        # Verify Absensi updated to HADIR
        absensi = Absensi.objects.get(siswa=self.siswa, date=date)
        self.assertEqual(absensi.status, Absensi.StatusChoices.HADIR)
