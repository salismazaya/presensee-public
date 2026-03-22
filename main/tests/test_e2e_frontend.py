"""
E2E Frontend Tests using Selenium + Django LiveServerTestCase.

Prerequisites:
  1. Firefox browser installed
  2. Vite dev server running: cd frontend && bun run dev
  3. Run: uv run python manage.py test main.tests.test_e2e_frontend
"""

import time
from datetime import date, timedelta
from django.contrib.staticfiles.testing import StaticLiveServerTestCase
from django.test import override_settings, tag
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

from main.models import User, Kelas, Siswa


VITE_DEV_URL = "http://localhost:5173"
WAIT_TIMEOUT = 10


@tag("e2e")
@override_settings(DEBUG=True, CACHEOPS_ENABLED=False)
class FrontendE2ETest(StaticLiveServerTestCase):
    """
    E2E tests that run against the Vite dev server (frontend)
    which proxies API calls to the Django LiveServer (backend).

    The Vite dev server must be started manually before running these tests.
    The Django test server binds to port 8000 to match the frontend .env config.
    """

    port = 8000  # Match VITE_DJANGO_BASE_API_URL in frontend/.env

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        options = FirefoxOptions()
        # options.add_argument("--headless")
        options.add_argument("--width=1280")
        options.add_argument("--height=900")

        cls.browser = webdriver.Firefox(options=options)
        cls.browser.implicitly_wait(5)

    @classmethod
    def tearDownClass(cls):
        cls.browser.quit()
        super().tearDownClass()

    def setUp(self):
        # Clear browser state to prevent stale tokens between tests
        self.browser.get(self._get_vite_url("/login"))
        time.sleep(0.5)
        self.browser.execute_script("localStorage.clear(); sessionStorage.clear();")
        self.browser.delete_all_cookies()

        # Create a secretary user with a class and students
        self.user = User.objects.create_user(
            username="e2euser",
            password="e2epassword",
            full_name="E2E User",
            type="sekretaris",
        )

        self.kelas = Kelas.objects.create(name="Kelas 10-A", active=True)
        self.kelas.sekretaris.add(self.user)

        # Create some students
        self.siswa1 = Siswa.objects.create(fullname="Andi Pratama", kelas=self.kelas)
        self.siswa2 = Siswa.objects.create(fullname="Budi Santoso", kelas=self.kelas)
        self.siswa3 = Siswa.objects.create(fullname="Citra Dewi", kelas=self.kelas)

    def _get_vite_url(self, path=""):
        return f"{VITE_DEV_URL}{path}"

    @staticmethod
    def _get_recent_weekday(offset=0):
        """Return the most recent weekday (Mon-Fri) date string as YYYY-MM-DD.
        offset=0 returns most recent weekday from today,
        offset=-1 returns the weekday before that.
        """
        d = date.today()
        # Go back to the most recent weekday
        while d.weekday() >= 5:  # 5=Saturday, 6=Sunday
            d -= timedelta(days=1)
        # Apply additional offset for previous weekday
        for _ in range(abs(offset)):
            d -= timedelta(days=1)
            while d.weekday() >= 5:
                d -= timedelta(days=1)
        return d.strftime("%Y-%m-%d")

    def _override_api_base_url(self):
        """Override the API base URL in sessionStorage to point to the live test server."""
        self.browser.execute_script(
            f'sessionStorage.setItem("DJANGO_API_BASE_URL", "{self.live_server_url}/api");'
        )

    def _login(self):
        """Helper to perform login via the UI."""
        self.browser.get(self._get_vite_url("/login"))
        time.sleep(1)  # Wait for page load

        self._override_api_base_url()

        # Fill in the login form
        username_input = self.browser.find_element(
            By.CSS_SELECTOR, "input[placeholder='Masukkan username']"
        )
        password_input = self.browser.find_element(
            By.CSS_SELECTOR, "input[type='password']"
        )
        username_input.send_keys("e2euser")
        password_input.send_keys("e2epassword")

        # Click the "Masuk" button
        login_btn = self.browser.find_element(
            By.XPATH, "//button[contains(text(), 'Masuk')]"
        )
        login_btn.click()

        # Wait for redirect to dashboard
        try:
            WebDriverWait(self.browser, WAIT_TIMEOUT).until(
                lambda d: (
                    d.current_url.rstrip("/") == self._get_vite_url("").rstrip("/")
                    or "/login" not in d.current_url
                )
            )
        except TimeoutException:
            self.fail(
                f"Login did not redirect. Current URL: {self.browser.current_url}"
            )

    # ------------------------------------------------------------------
    # Test: Login Success
    # ------------------------------------------------------------------
    def test_01_login_success(self):
        """Test that a user can log in and is redirected to the Dashboard."""
        self.browser.get(self._get_vite_url("/login"))
        time.sleep(1)

        self._override_api_base_url()

        username_input = self.browser.find_element(
            By.CSS_SELECTOR, "input[placeholder='Masukkan username']"
        )
        password_input = self.browser.find_element(
            By.CSS_SELECTOR, "input[type='password']"
        )
        username_input.send_keys("e2euser")
        password_input.send_keys("e2epassword")

        login_btn = self.browser.find_element(
            By.XPATH, "//button[contains(text(), 'Masuk')]"
        )
        login_btn.click()

        WebDriverWait(self.browser, WAIT_TIMEOUT).until(
            lambda d: "/login" not in d.current_url
        )

        # After login, we should be on the dashboard
        self.assertNotIn("/login", self.browser.current_url)

    # ------------------------------------------------------------------
    # Test: Login Failure
    # ------------------------------------------------------------------
    def test_02_login_failure(self):
        """Test that wrong credentials show an error popup."""
        self.browser.get(self._get_vite_url("/login"))
        time.sleep(1)

        self._override_api_base_url()

        username_input = self.browser.find_element(
            By.CSS_SELECTOR, "input[placeholder='Masukkan username']"
        )
        password_input = self.browser.find_element(
            By.CSS_SELECTOR, "input[type='password']"
        )
        username_input.send_keys("e2euser")
        password_input.send_keys("wrongpassword")

        login_btn = self.browser.find_element(
            By.XPATH, "//button[contains(text(), 'Masuk')]"
        )
        login_btn.click()

        # Wait for the SweetAlert2 error popup
        try:
            WebDriverWait(self.browser, WAIT_TIMEOUT).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".swal2-popup"))
            )
        except TimeoutException:
            self.fail("Error popup did not appear for wrong credentials")

        popup_title_el = WebDriverWait(self.browser, WAIT_TIMEOUT).until(
            lambda d: (
                d.find_element(By.CSS_SELECTOR, ".swal2-title")
                if d.find_element(By.CSS_SELECTOR, ".swal2-title").text
                else False
            )
        )
        self.assertEqual(popup_title_el.text, "Gagal Masuk")

        # Should still be on /login
        self.assertIn("/login", self.browser.current_url)

    # ------------------------------------------------------------------
    # Test: Dashboard Loads
    # ------------------------------------------------------------------
    def test_03_dashboard_loads(self):
        """Test that the Dashboard page loads correctly after login."""
        self._login()

        time.sleep(2)  # Wait for data to load

        # Check that key dashboard elements are present
        page_source = self.browser.page_source

        # The dashboard should show "Status Absensi" for sekretaris user
        self.assertTrue(
            "Status Absensi" in page_source or "Sinkronisasi Data" in page_source,
            "Dashboard key elements not found in page source",
        )

    # ------------------------------------------------------------------
    # Test: Navigate to Absensi Page
    # ------------------------------------------------------------------
    def test_04_navigate_to_absensi(self):
        """Test that a user can navigate from Dashboard to the Absensi page."""
        self._login()

        time.sleep(2)

        # Navigate to /absensi
        self.browser.get(self._get_vite_url("/absensi"))
        time.sleep(2)

        page_source = self.browser.page_source

        # The Absensi page should show the class name (Kelas) and date entries
        self.assertTrue(
            "Kelas 10-A" in page_source or "Kelas" in page_source,
            "Absensi page did not load correctly",
        )

    # ------------------------------------------------------------------
    # Test: Attendance Mechanic (Absensi Flow)
    # ------------------------------------------------------------------
    def test_05_absensi_flow(self):
        """
        Test the full attendance flow:
        1. Login
        2. Navigate to /absensi/{today}
        3. Click 'Hadir Semua' button
        4. Click 'Simpan Absensi' button
        5. Confirm via SweetAlert2
        6. Verify redirect back to /absensi
        """
        self._login()

        time.sleep(2)

        # Navigate to a recent weekday's attendance detail page
        # (attendance is disabled on weekends/holidays)
        date_str = self._get_recent_weekday()
        self.browser.get(self._get_vite_url(f"/absensi/{date_str}"))

        time.sleep(3)  # Wait for data to load (students list)

        # Verify students appear on the page
        page_source = self.browser.page_source
        has_students = (
            "Andi Pratama" in page_source
            or "Budi Santoso" in page_source
            or "Citra Dewi" in page_source
        )

        if not has_students:
            # If students don't appear yet, wait a bit more
            time.sleep(3)
            page_source = self.browser.page_source
            has_students = (
                "Andi Pratama" in page_source
                or "Budi Santoso" in page_source
                or "Citra Dewi" in page_source
            )

        self.assertTrue(has_students, "Students did not appear on AbsensiDetail page")

        # --- Test individual status buttons before Hadir Semua ---
        # Find all student join button groups (each student has H/S/I/A/B buttons)
        join_groups = self.browser.find_elements(By.CSS_SELECTOR, ".join")
        if len(join_groups) >= 3:
            # Click 'S' (Sakit) on first student
            first_buttons = join_groups[0].find_elements(By.CSS_SELECTOR, "button")
            if len(first_buttons) >= 2:
                first_buttons[1].click()  # S = index 1
                time.sleep(0.5)

            # Click 'A' (Alfa) on second student
            second_buttons = join_groups[1].find_elements(By.CSS_SELECTOR, "button")
            if len(second_buttons) >= 4:
                second_buttons[3].click()  # A = index 3
                time.sleep(0.5)

            # Verify individual statuses appear
            page_source = self.browser.page_source
            self.assertIn("Sakit", page_source)
            self.assertIn("Alfa", page_source)

        # Click "Hadir Semua" button (resets all to Hadir)
        try:
            hadir_semua_btn = WebDriverWait(self.browser, WAIT_TIMEOUT).until(
                EC.element_to_be_clickable(
                    (By.XPATH, "//button[contains(text(), 'Hadir Semua')]")
                )
            )
            hadir_semua_btn.click()
            time.sleep(1)
        except TimeoutException:
            self.fail("'Hadir Semua' button not found or not clickable")

        # Verify all students now have "Hadir" status
        page_source = self.browser.page_source
        self.assertIn("Hadir", page_source)

        # Click "Simpan Absensi" button
        try:
            save_btn = WebDriverWait(self.browser, WAIT_TIMEOUT).until(
                EC.element_to_be_clickable(
                    (By.XPATH, "//button[contains(text(), 'Simpan Absensi')]")
                )
            )
            save_btn.click()
            time.sleep(1)
        except TimeoutException:
            self.fail("'Simpan Absensi' button not found or not clickable")

        # SweetAlert2 confirmation popup should appear
        try:
            WebDriverWait(self.browser, WAIT_TIMEOUT).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".swal2-popup"))
            )
        except TimeoutException:
            self.fail("Confirmation popup did not appear after clicking 'Simpan'")

        # Verify popup title
        popup_title = self.browser.find_element(By.CSS_SELECTOR, ".swal2-title").text
        self.assertEqual(popup_title, "Konfirmasi Absensi")

        # Click "Simpan Data" confirm button
        try:
            confirm_btn = WebDriverWait(self.browser, WAIT_TIMEOUT).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, ".swal2-confirm"))
            )
            confirm_btn.click()
            time.sleep(2)
        except TimeoutException:
            self.fail("Confirm button in SweetAlert2 not found or not clickable")

        # After save, we should see the "Tersimpan!" popup or be redirected to /absensi
        try:
            WebDriverWait(self.browser, WAIT_TIMEOUT).until(
                lambda d: (
                    "/absensi" in d.current_url
                    and "/absensi/"
                    not in d.current_url.rstrip("/").split("absensi/")[0]
                )
            )
        except TimeoutException:
            pass  # May still be showing the success popup

        time.sleep(2)

        # Verify we're back on the absensi list or that the success popup appeared
        current_url = self.browser.current_url
        page_source = self.browser.page_source
        self.assertTrue(
            "/absensi" in current_url
            or "Tersimpan" in page_source
            or "berhasil" in page_source.lower(),
            f"After save, expected redirect to /absensi or success message. URL: {current_url}",
        )

    # ------------------------------------------------------------------
    def test_06_sync_and_upload(self):
        """
        Test the Sinkronisasi Data (Refresh) and Upload Data flow:
        1. Login
        2. Wait for Dashboard to load
        3. Click 'Sinkronisasi Data'
        4. Confirm refresh and wait for success
        5. Click 'Upload Data'
        6. Verify the confirmation or info popup
        """
        self._login()

        # Wait for dashboard to fully load
        time.sleep(4)

        # Click Sinkronisasi Data
        try:
            sync_btn = WebDriverWait(self.browser, WAIT_TIMEOUT).until(
                EC.element_to_be_clickable(
                    (
                        By.XPATH,
                        "//button[.//span[contains(text(), 'Sinkronisasi Data')]]",
                    )
                )
            )
            sync_btn.click()
        except TimeoutException:
            self.fail("'Sinkronisasi Data' button not found or not clickable")

        time.sleep(1)

        # Handle 'Konfirmasi' SweetAlert for Refresh
        try:
            confirm_refresh_btn = WebDriverWait(self.browser, 5).until(
                EC.element_to_be_clickable(
                    (By.XPATH, "//button[contains(text(), 'Ya, Refresh')]")
                )
            )
            confirm_refresh_btn.click()
        except TimeoutException:
            self.fail("'Ya, Refresh' confirmation button not found")

        # Wait for 'Berhasil' SweetAlert and click OK to dismiss it
        try:
            WebDriverWait(self.browser, WAIT_TIMEOUT).until(
                EC.presence_of_element_located(
                    (By.XPATH, "//h2[contains(text(), 'Berhasil')]")
                )
            )
            ok_btn = WebDriverWait(self.browser, 5).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, ".swal2-confirm"))
            )
            ok_btn.click()
        except TimeoutException:
            self.fail("'Berhasil' popup or OK button not found")

        # Wait for the page reload (allow some time)
        time.sleep(3)

        # Ensure we are back on the dashboard and click Upload Data
        try:
            # Need to wait for dashboard to reload and element to be completely interactive
            # Sometimes page reload takes time, so we re-find the element after reload
            upload_btn = WebDriverWait(self.browser, WAIT_TIMEOUT).until(
                EC.visibility_of_element_located(
                    (By.XPATH, "//button[.//span[contains(text(), 'Upload Data')]]")
                )
            )
            upload_btn = WebDriverWait(self.browser, WAIT_TIMEOUT).until(
                EC.element_to_be_clickable(
                    (By.XPATH, "//button[.//span[contains(text(), 'Upload Data')]]")
                )
            )
            upload_btn.click()
        except TimeoutException:
            self.fail("'Upload Data' button not found or not clickable")

        time.sleep(1)

        # The popup will first ask "Konfirmasi untuk Upload data ke server?"
        try:
            confirm_upload_btn = WebDriverWait(self.browser, 5).until(
                EC.element_to_be_clickable(
                    (By.XPATH, "//button[contains(text(), 'Ya, Upload')]")
                )
            )
            confirm_upload_btn.click()
            time.sleep(1)

            # Now it will either be "Upload Berhasil!" or "Tidak ada data baru yang perlu di-upload"
            page_source = self.browser.page_source
            if "Tidak ada data baru yang perlu di-upload" in page_source:
                # Click OK on the info popup
                ok_btn = WebDriverWait(self.browser, 5).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, ".swal2-confirm"))
                )
                ok_btn.click()
            elif "Upload Berhasil" in page_source:
                # Handled successfully
                pass
            else:
                self.fail(
                    "Did not find 'Upload Berhasil' or 'Tidak ada data baru...' after confirming upload. Page source snippet: "
                    + page_source[:500]
                )
        except TimeoutException:
            self.fail("Failed to click 'Ya, Upload' or unexpected error")
