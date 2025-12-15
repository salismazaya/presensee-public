## ⚠️ PERINGATAN

*Software ini GRATIS*

* ✅ **Diperbolehkan:** Penggunaan pribadi atau instansi internal.
* ❌ **Dilarang:** Menjual software ini atau menggunakannya untuk tujuan komersil tanpa izin.

---

# **Presensee 📱**

![Presensee Banner](frontend/public/logo.png)

> **Sistem Absensi Modern dengan Arsitektur Offline-First — cepat, ringan, dan tetap jalan meskipun tanpa internet.**

[![Django](https://img.shields.io/badge/Django-5.2-green)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-Bundler-purple)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8)](https://tailwindcss.com/)
[![uv](https://img.shields.io/badge/uv-Python_Manager-de5fe7)](https://github.com/astral-sh/uv)
[![Bun](https://img.shields.io/badge/Bun-Frontend_Runtime-black)](https://bun.sh/)


**Presensee** adalah aplikasi absensi berbasis web dengan pendekatan **Offline-First**, dirancang agar **absensi tetap bisa jalan di mana saja** — di kelas, lapangan, atau area tanpa sinyal. Cukup input data, lalu **sinkronisasi otomatis** begitu internet tersedia.

Dibangun menggunakan stack modern: **Django** di backend, **React (Vite)** di frontend.

---

## 🌟 Fitur Utama

* 📡 **Offline-First:** Absensi tetap bisa di-input tanpa internet. Sinkronisasi dilakukan nanti saat online.
* 👥 **Role-Based Access:**

  * **Sekretaris** → Input absensi harian.
  * **Wali Kelas** → Monitoring, kunci absensi, dan lihat rekap.
  * **Kesiswaan** → Lihat rekap seluruh kelas.
  * **Guru Piket** → Absensi siswa menggunakan QRCode.
  * **Admin** → Full Power.
* 📊 **Rekap Pintar:** Filter otomatis berdasarkan Bulan, Minggu, atau Rentang Tanggal.
* 📄 **Export & Share:** Generate laporan bulanan + fitur *native share* (WhatsApp/Telegram).
* 🎨 **UI Modern & Responsif** dengan dukungan Dark/Light Mode.

---

## 🛠️ Requirements


1. **[uv](https://docs.astral.sh/uv/)** – Python Package Manager.
2. **[Bun](https://bun.com/)** – Untuk build frontend.
3. **[PostgreSQL Server](https://codingstudio.id/blog/postgresql-adalah/)** atau **[MySQL Server](https://www.mysql.com/)** – Database utama.
4. **[Redis Server](https://redis.io/)** – Caching.

---

## 🚀 Instalasi

### 1. Clone Repository

```bash
git clone https://github.com/salismazaya/presensee-public.git
cd presensee-public
```

---

### 2. Setup Backend (Django)

Masih di folder utama:

```bash
# Install python
uv python install

# Install dependencies backend
uv sync

# Setup environment variables
cp .env.example .env
```

---

### 3. Setup Frontend (React + Vite)

```bash
cd frontend

# Install deps
bun install

# Build assets
bun run build

cd ..
```

---

## ⚡ Menjalankan Aplikasi

Jalankan server menggunakan Granian:

```bash
uv run granian --interface wsgi django_project.wsgi:application --env-files .env
```

Akses melalui: **[http://127.0.0.1:8000](http://127.0.0.1:8000)** (atau sesuai config Anda).<br>
Buka **[http://127.0.0.1:8000/setup](http://127.0.0.1:8000/setup)** untuk setup awal.<br><br>

Baca lebih lanjut tentang **[Granian](https://github.com/emmett-framework/granian)**

---

## 👥 Kredit

Crafted with ❤️ by **[Salis Mazaya](https://mazaya.is-a.dev)**

---
