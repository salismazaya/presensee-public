from django.test import TestCase, Client, override_settings
from main.models import User, Kelas, Siswa
from main.api.api import api


@override_settings(DEBUG=True)
class SiswaApiTest(TestCase):
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

    def test_get_siswas_success(self):
        response = self.client.get(
            "/api/siswas", headers={"Authorization": "Bearer testtoken"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("data", data)
        self.assertIn(str(self.siswa.pk), data["data"])
        self.assertEqual(data["data"][str(self.siswa.pk)]["name"], "Siswa 1")

    def test_get_siswas_forbidden(self):
        # Change user type to something not allowed
        self.user.type = "wali_kelas"
        self.user.save()

        response = self.client.get(
            "/api/siswas", headers={"Authorization": "Bearer testtoken"}
        )
        self.assertEqual(response.status_code, 403)
