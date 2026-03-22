from django.test import TestCase, Client, override_settings
from main.models import User, Kelas, Siswa, Absensi
from main.api.api import api
from django.utils import timezone


@override_settings(DEBUG=True)
class AbsensiApiTest(TestCase):
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
            type="kesiswaan",  # Use kesiswaan to pass Kelas.objects.own()
        )
        self.user.token = "testtoken"
        self.user.save()

        self.kelas = Kelas.objects.create(name="Kelas 10-A", active=True)
        self.siswa = Siswa.objects.create(fullname="Siswa 1", kelas=self.kelas)

        self.date_str = timezone.now().date().isoformat()
        self.absensi = Absensi.objects.create(
            date=timezone.now().date(),
            siswa=self.siswa,
            _status=Absensi.StatusChoices.HADIR,
            by=self.user,
        )

    def test_get_absensi_success(self):
        response = self.client.get(
            f"/api/absensi?date={self.date_str}&kelas_id={self.kelas.pk}",
            headers={"Authorization": "Bearer testtoken"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("data", data)
        self.assertEqual(data["data"][str(self.siswa.pk)], Absensi.StatusChoices.HADIR)

    def test_get_absensi_not_found(self):
        # Request for a non-existent class
        response = self.client.get(
            f"/api/absensi?date={self.date_str}&kelas_id=999",
            headers={"Authorization": "Bearer testtoken"},
        )
        self.assertEqual(response.status_code, 404)

    def test_get_absensi_progress_success(self):
        response = self.client.get(
            f"/api/absensi/progress?kelas_id={self.kelas.pk}&dates={self.date_str}",
            headers={"Authorization": "Bearer testtoken"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn(self.date_str, data["data"])
        self.assertTrue(data["data"][self.date_str]["is_complete"])
        self.assertEqual(data["data"][self.date_str]["total_tidak_masuk"], 0)
