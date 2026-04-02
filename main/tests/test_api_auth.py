from django.test import TestCase, Client, override_settings
from main.models import User
from main.api.api import api


@override_settings(DEBUG=True)
class AuthApiTest(TestCase):
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

    def test_login_success(self):
        response = self.client.post(
            "/api/login",
            data={"username": "testuser", "password": "testpassword"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("token", data["data"])
        self.assertEqual(data["data"]["username"], "testuser")

    def test_login_fail(self):
        response = self.client.post(
            "/api/login",
            data={"username": "testuser", "password": "wrongpassword"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Username/password salah")

    def test_change_password_success(self):
        # First login to get token
        login_response = self.client.post(
            "/api/login",
            data={"username": "testuser", "password": "testpassword"},
            content_type="application/json",
        )
        token = login_response.json()["data"]["token"]

        # Change password
        response = self.client.post(
            "/api/change-password",
            data={"old_password": "testpassword", "new_password": "newpassword"},
            headers={"Authorization": f"Bearer {token}"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["data"]["success"])

        # Verify password changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newpassword"))

    def test_change_password_fail(self):
        login_response = self.client.post(
            "/api/login",
            data={"username": "testuser", "password": "testpassword"},
            content_type="application/json",
        )
        token = login_response.json()["data"]["token"]

        response = self.client.post(
            "/api/change-password",
            data={"old_password": "wrongpassword", "new_password": "newpassword"},
            headers={"Authorization": f"Bearer {token}"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Password salah!")
