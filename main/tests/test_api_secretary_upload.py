import json
import time
from datetime import datetime
from django.test import TestCase, Client, override_settings
from main.models import User, Kelas, Siswa, Absensi
from main.api.api import api


@override_settings(DEBUG=True)
class SecretaryUploadApiTest(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        api.throttle = []

    def setUp(self):
        self.client = Client()
        # Create a secretary user
        self.secretary = User.objects.create_user(
            username="secretary",
            password="testpassword",
            full_name="Secretary User",
            type="sekretaris",
        )
        self.secretary.token = "testtoken"
        self.secretary.save()

        # Create a class and assign the secretary
        self.kelas = Kelas.objects.create(name="Kelas 10-B", active=True)
        self.kelas.sekretaris.add(self.secretary)

        # Create a student in that class
        self.siswa = Siswa.objects.create(fullname="Siswa B1", kelas=self.kelas)

        # Fixed date for testing (must not be in the future)
        self.date_str = "21-03-26"  # DD-MM-YY
        self.date_obj = datetime(2026, 3, 21)

    def test_secretary_upload_absen_success(self):
        timestamp = int(time.time())
        payload = {
            "date": self.date_str,
            "siswa": self.siswa.pk,
            "status": "hadir",
            "updated_at": timestamp,
        }

        data = {"data": [{"action": "absen", "data": json.dumps(payload)}]}

        response = self.client.post(
            "/api/upload",
            data=data,
            content_type="application/json",
            headers={"Authorization": "Bearer testtoken"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"data": {"conflicts": []}})

        # Verify Absensi created
        self.assertTrue(
            Absensi.objects.filter(
                siswa=self.siswa,
                date=self.date_obj.date(),
                _status="hadir",
                by=self.secretary,
            ).exists()
        )

    def test_secretary_upload_absen_forbidden(self):
        # Create another secretary not assigned to this class
        other_secretary = User.objects.create_user(
            username="other_secretary",
            password="testpassword",
            full_name="Other Secretary",
            type="sekretaris",
        )
        other_secretary.token = "othertoken"
        other_secretary.save()

        timestamp = int(time.time())
        payload = {
            "date": self.date_str,
            "siswa": self.siswa.pk,
            "status": "hadir",
            "updated_at": timestamp,
        }

        data = {"data": [{"action": "absen", "data": json.dumps(payload)}]}

        response = self.client.post(
            "/api/upload",
            data=data,
            content_type="application/json",
            headers={"Authorization": "Bearer othertoken"},
        )

        # The endpoint continues/skips if not authorized, but let's check if Absensi was NOT created
        self.assertEqual(
            response.status_code, 200
        )  # Endpoint returns 200 but skips the record
        self.assertFalse(
            Absensi.objects.filter(
                siswa=self.siswa, date=self.date_obj.date(), by=other_secretary
            ).exists()
        )
