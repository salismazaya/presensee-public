# Panduan Pengembangan Presensee 📱

File ini berisi instruksi, perintah penting, dan aturan gaya penulisan kode untuk proyek **Presensee** (Sistem Absensi Modern dengan Arsitektur Offline-First).

---

## 🛠️ Perintah Pengembangan (Build & Run)

### 🐍 Backend (Django)
Backend menggunakan **Django 5.2** dengan package manager **uv**.

*   **Setup Lingkungan & Dependensi:**
    ```bash
    uv python install
    uv sync
    cp .env.example .env
    ```
*   **Menjalankan Server Pengembangan (Dev):**
    ```bash
    # Menggunakan Makefile
    make runserver
    # Atau langsung dengan uv
    uv run python manage.py runserver
    ```
*   **Migrasi Database:**
    ```bash
    # Membuat migrasi baru
    make makemigrations   # atau: uv run python manage.py makemigrations
    # Menjalankan migrasi
    make migrate          # atau: uv run python manage.py migrate
    ```
*   **Menjalankan Server Produksi (Granian):**
    ```bash
    # Menggunakan Granian server (WSGI interface)
    uv run granian --interface wsgi django_project.wsgi:application --env-files .env
    # Atau menggunakan script run.sh
    ./run.sh
    ```

### ⚡ Frontend (React + Vite)
Frontend menggunakan **React 19**, **Vite**, **TypeScript**, dan **Bun** sebagai runtime/package manager.

*   **Instalasi Dependensi:**
    ```bash
    cd frontend
    bun install
    ```
*   **Menjalankan Server Pengembangan (Vite Dev):**
    ```bash
    bun run dev
    ```
*   **Build untuk Produksi:**
    ```bash
    bun run build
    ```
*   **Linting & Kode Kualitas:**
    ```bash
    bun run lint
    ```
*   **Preview Build Produksi:**
    ```bash
    bun run preview
    ```

---

## 🧪 Perintah Pengujian (Testing)

Pengujian backend menggunakan test suite bawaan Django.

*   **Menjalankan Unit Test (tanpa E2E):**
    ```bash
    make test             # atau: uv run python manage.py test main.tests --exclude-tag=e2e
    ```
*   **Menjalankan E2E Frontend Test:**
    ```bash
    make test-e2e         # atau: uv run python manage.py test main.tests.test_e2e_frontend
    ```

---

## 📐 Gaya Penulisan Kode (Code Style & Guidelines)

### 1. Backend (Python/Django)
*   **Framework API:** Selalu gunakan **Django Ninja** untuk membangun REST API yang interaktif dan cepat.
    *   Definisikan Pydantic Schemas di `main/api/schemas.py`.
    *   Definisikan API Router di berkas terpisah di bawah `main/api/router/`.
    *   Gunakan `AuthBearer` (`main/api/core/auth.py`) untuk autentikasi endpoint yang dilindungi.
*   **Model & Database:**
    *   Gunakan Custom Managers & QuerySets untuk operasi database yang berulang (misal `own()`, `only_active()`).
    *   Semua model mewarisi `BaseModel` dari `main.models.base`.
    *   Perhatikan aturan model `Absensi` yang memiliki validasi `wait_expired_at` dan status `tunggu/bolos/hadir`.
*   **Caching:** Proyek ini menggunakan `django-cacheops` dengan Redis. Pastikan operasi database yang sering digunakan mendukung query caching.

### 2. Frontend (React/TypeScript)
*   **Gaya Penulisan React:** Gunakan functional components dengan React Hooks secara konsisten.
*   **TypeScript:** Terapkan typing yang ketat. Jangan gunakan `any` jika memungkinkan. Deklarasikan tipe/interface secara eksplisit untuk response API.
*   **Styling (Tailwind CSS 4.0 & DaisyUI 5.0):**
    *   Gunakan kelas utility Tailwind secara rapi dan modular.
    *   Gunakan DaisyUI untuk komponen siap pakai (buttons, modals, cards, dll) untuk menjaga estetika visual yang konsisten.
*   **Arsitektur Offline-First:**
    *   Presensee didesain untuk berjalan offline. Sinkronisasi data di-handle melalui caching lokal (`sql.js`, `lz-string`).
    *   Pastikan alur sinkronisasi offline-to-online tidak menghasilkan konflik data yang merusak integritas database utama.

### 3. Struktur Berkas Utama
*   `django_project/` - Pengaturan utama project Django (settings, urls, wsgi).
*   `main/` - Aplikasi Django utama berisi API, model absensi, template, views, dan manajemen command.
*   `frontend/` - Aplikasi SPA React (Vite).