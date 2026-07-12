import random
from datetime import datetime, time, timedelta
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.db import transaction

from main.models import User, Kelas, Siswa, KunciAbsensi, Absensi, AbsensiSession, Data


class Command(BaseCommand):
    help = "Menyisipkan data dummy terstruktur untuk pengembangan aplikasi Presensee"

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=14,
            help="Jumlah hari ke belakang untuk diisi data absensinya (default: 14 hari)",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        days = options["days"]

        # Validasi bahwa database kosong (abaikan superuser)
        has_normal_users = User.objects.filter(is_superuser=False).exists()
        has_kelas = Kelas.objects.exists()
        has_siswa = Siswa.objects.exists()
        has_absensi = Absensi.objects.exists()
        has_sessions = AbsensiSession.objects.exists()
        has_kunci = KunciAbsensi.objects.exists()

        if (
            has_normal_users
            or has_kelas
            or has_siswa
            or has_absensi
            or has_sessions
            or has_kunci
        ):
            raise CommandError(
                "Database tidak kosong! Perintah 'seeddummy' hanya dapat "
                "dijalankan saat database kosong untuk mencegah duplikasi/konflik data."
            )

        # 1. Pastikan superuser/admin utama ada
        superusers = User.objects.filter(is_superuser=True)
        if not superusers.exists():
            self.stdout.write(self.style.WARNING("Membuat superuser admin default..."))
            User.objects.create_superuser(
                username="admin",
                password="admin123",
                full_name="Administrator Presensee",
                email="admin@presensee.sch.id",
                token="token_admin",
            )
            self.stdout.write(
                self.style.SUCCESS(
                    "Superuser dibuat: admin / admin123 (Token: token_admin)"
                )
            )
        else:
            superusers.first()

        # 2. Buat Pengguna Staff / Sekolah
        self.stdout.write("Membuat pengguna dengan berbagai role...")

        # password default untuk dummy
        password_default = "password123"

        # Kesiswaan
        User.objects.create_user(
            username="kesiswaan1",
            password=password_default,
            full_name="Budi Hartono, M.Pd.",
            type=User.TypeChoices.KESISWAAN,
            token="token_kesiswaan1",
            is_staff=True,
        )

        # Guru Piket
        piket1 = User.objects.create_user(
            username="piket1",
            password=password_default,
            full_name="Siti Aminah, S.Pd.",
            type=User.TypeChoices.GURU_PIKET,
            token="token_piket1",
            is_staff=True,
        )
        piket2 = User.objects.create_user(
            username="piket2",
            password=password_default,
            full_name="Joko Susilo, S.Pd.",
            type=User.TypeChoices.GURU_PIKET,
            token="token_piket2",
            is_staff=True,
        )

        # Wali Kelas
        wali_ipa = User.objects.create_user(
            username="wali_ipa1",
            password=password_default,
            full_name="Drs. H. Ahmad Dahlan",
            type=User.TypeChoices.WALI_KELAS,
            token="token_wali_ipa1",
            is_staff=True,
        )
        wali_ips = User.objects.create_user(
            username="wali_ips1",
            password=password_default,
            full_name="Rina Wijayanti, S.Pd.",
            type=User.TypeChoices.WALI_KELAS,
            token="token_wali_ips1",
            is_staff=True,
        )
        wali_bahasa = User.objects.create_user(
            username="wali_bahasa1",
            password=password_default,
            full_name="Hendry Gunawan, M.Hum.",
            type=User.TypeChoices.WALI_KELAS,
            token="token_wali_bahasa1",
            is_staff=True,
        )

        # Sekretaris Kelas
        sek_ipa = User.objects.create_user(
            username="sek_ipa1",
            password=password_default,
            full_name="Ayu Lestari",
            type=User.TypeChoices.SEKRETARIS,
            token="token_sek_ipa1",
            is_staff=False,
        )
        sek_ips = User.objects.create_user(
            username="sek_ips1",
            password=password_default,
            full_name="Bambang Tri",
            type=User.TypeChoices.SEKRETARIS,
            token="token_sek_ips1",
            is_staff=False,
        )
        sek_bahasa = User.objects.create_user(
            username="sek_bahasa1",
            password=password_default,
            full_name="Chandra Kirana",
            type=User.TypeChoices.SEKRETARIS,
            token="token_sek_bahasa1",
            is_staff=False,
        )

        self.stdout.write(self.style.SUCCESS("Pengguna berhasil dibuat."))

        # 3. Buat Kelas
        self.stdout.write("Membuat data kelas...")

        kelas_ipa = Kelas.objects.create(
            name="X IPA 1", wali_kelas=wali_ipa, active=True
        )
        kelas_ipa.sekretaris.add(sek_ipa)

        kelas_ips = Kelas.objects.create(
            name="XI IPS 1", wali_kelas=wali_ips, active=True
        )
        kelas_ips.sekretaris.add(sek_ips)

        kelas_bahasa = Kelas.objects.create(
            name="XII Bahasa 1", wali_kelas=wali_bahasa, active=True
        )
        kelas_bahasa.sekretaris.add(sek_bahasa)

        self.stdout.write(self.style.SUCCESS("Kelas berhasil dibuat."))

        # 4. Buat Siswa
        self.stdout.write("Membuat data siswa...")

        students_ipa = [
            ("Ahmad Fauzi", "1001", "0098765401"),
            ("Budi Santoso", "1002", "0098765402"),
            ("Citra Lestari", "1003", "0098765403"),
            ("Dewi Sartika", "1004", "0098765404"),
            ("Eko Prasetyo", "1005", "0098765405"),
            ("Farhan Hidayat", "1006", "0098765406"),
            ("Gita Permata", "1007", "0098765407"),
            ("Hendra Wijaya", "1008", "0098765408"),
            ("Indah Sari", "1009", "0098765409"),
            ("Joko Widodo", "1010", "0098765410"),
            ("Kartika Putri", "1011", "0098765411"),
            ("Lukman Hakim", "1012", "0098765412"),
        ]

        students_ips = [
            ("Adi Nugroho", "1101", "0088765401"),
            ("Bambang Pamungkas", "1102", "0088765402"),
            ("Dian Sastrowardoyo", "1103", "0088765403"),
            ("Fajar Sidik", "1104", "0088765404"),
            ("Heri Setiawan", "1105", "0088765405"),
            ("Iwan Fals", "1106", "0088765406"),
            ("Lilis Karlina", "1107", "0088765407"),
            ("Mamat Alkatiri", "1108", "0088765408"),
            ("Nabila Syakieb", "1109", "0088765409"),
            ("Oky Lukman", "1110", "0088765410"),
            ("Putu Gede", "1111", "0088765411"),
            ("Rendi Irwan", "1112", "0088765412"),
        ]

        students_bahasa = [
            ("Anang Hermansyah", "1201", "0078765401"),
            ("Bella Saphira", "1202", "0078765402"),
            ("Cici Paramida", "1203", "0078765403"),
            ("Didi Kempot", "1204", "0078765404"),
            ("Elvy Sukaesih", "1205", "0078765405"),
            ("Feni Rose", "1206", "0078765406"),
            ("Gading Marten", "1207", "0078765407"),
            ("Inul Daratista", "1208", "0078765408"),
            ("Julia Perez", "1209", "0078765409"),
            ("Krisdayanti", "1210", "0078765410"),
            ("Luna Maya", "1211", "0078765411"),
            ("Sule Sutisna", "1212", "0078765412"),
        ]

        siswa_objects = []

        for name, nis, nisn in students_ipa:
            siswa_objects.append(
                Siswa(fullname=name, kelas=kelas_ipa, nis=nis, nisn=nisn)
            )
        for name, nis, nisn in students_ips:
            siswa_objects.append(
                Siswa(fullname=name, kelas=kelas_ips, nis=nis, nisn=nisn)
            )
        for name, nis, nisn in students_bahasa:
            siswa_objects.append(
                Siswa(fullname=name, kelas=kelas_bahasa, nis=nis, nisn=nisn)
            )

        Siswa.objects.bulk_create(siswa_objects)
        # Ambil data siswa dari database agar memiliki primary key
        all_siswa = list(Siswa.objects.all())
        self.stdout.write(
            self.style.SUCCESS(f"Berhasil membuat {len(all_siswa)} siswa.")
        )

        # 5. Buat Jadwal Absensi / AbsensiSession
        self.stdout.write("Membuat jadwal absensi default...")
        session = AbsensiSession.objects.create(
            senin=True,
            selasa=True,
            rabu=True,
            kamis=True,
            jumat=True,
            sabtu=False,
            jam_masuk="07:00:00",
            jam_masuk_toleransi=timedelta(minutes=15),
            jam_keluar_mulai_absen="13:30:00",
            jam_keluar="14:00:00",
        )
        session.kelas.add(kelas_ipa, kelas_ips, kelas_bahasa)
        self.stdout.write(self.style.SUCCESS("Jadwal absensi berhasil dibuat."))

        # 6. Buat Absensi & KunciAbsensi Historis
        self.stdout.write(
            f"Membuat data absensi historis untuk {days} hari ke belakang..."
        )

        today = timezone.now().date()

        class_helper = {
            kelas_ipa.pk: {
                "sekretaris": sek_ipa,
                "siswas": [s for s in all_siswa if s.kelas_id == kelas_ipa.pk],
            },
            kelas_ips.pk: {
                "sekretaris": sek_ips,
                "siswas": [s for s in all_siswa if s.kelas_id == kelas_ips.pk],
            },
            kelas_bahasa.pk: {
                "sekretaris": sek_bahasa,
                "siswas": [s for s in all_siswa if s.kelas_id == kelas_bahasa.pk],
            },
        }

        absensi_records = []
        kunci_records = []

        status_choices = ["hadir", "sakit", "izin", "alfa", "bolos"]
        status_weights = [0.88, 0.04, 0.04, 0.02, 0.02]

        for day_offset in range(days, -1, -1):
            target_date = today - timedelta(days=day_offset)

            # Lewati hari sabtu (5) dan minggu (6)
            if target_date.weekday() >= 5:
                continue

            for kelas_id, info in class_helper.items():
                is_locked = day_offset > 0

                kunci_records.append(
                    KunciAbsensi(date=target_date, kelas_id=kelas_id, locked=is_locked)
                )

                # Catat absensi untuk setiap siswa di kelas ini
                for siswa in info["siswas"]:
                    status = random.choices(
                        status_choices, weights=status_weights, k=1
                    )[0]

                    random_min = random.randint(0, 14)
                    random_sec = random.randint(0, 59)

                    # Buat datetime lokal, lalu jadikan aware
                    naive_datetime = datetime.combine(
                        target_date,
                        time(
                            hour=7,
                            minute=random_min,
                            second=random_sec,
                        ),
                    )
                    created_at = timezone.make_aware(
                        naive_datetime, timezone.get_current_timezone()
                    )

                    # Absensi dicatat oleh Sekretaris Kelas (80%) atau Guru Piket (20%)
                    if random.random() < 0.8:
                        recorded_by = info["sekretaris"]
                    else:
                        recorded_by = random.choice([piket1, piket2])

                    absensi_records.append(
                        Absensi(
                            date=target_date,
                            siswa=siswa,
                            _status=status,
                            by=recorded_by,
                            created_at=created_at,
                            updated_at=created_at,
                        )
                    )

        # Bulk create Kunci dan Absensi untuk performasi tinggi
        KunciAbsensi.objects.bulk_create(kunci_records)
        Absensi.objects.bulk_create(absensi_records)

        self.stdout.write(
            self.style.SUCCESS(
                f"Berhasil membuat {len(kunci_records)} KunciAbsensi dan {len(absensi_records)} record Absensi."
            )
        )

        # 7. Buat / Update Data Sekolah
        Data.objects.update_or_create(
            id=1,
            defaults={
                "nama_sekolah": "SMA Negeri 1 Antigravity",
                "deskripsi_sekolah": "Sekolah Menengah Atas dengan sistem absensi pintar Presensee.",
                "nama_aplikasi": "Presensee",
            },
        )
        self.stdout.write(
            self.style.SUCCESS("Data profil sekolah berhasil diperbarui.")
        )

        # Selesai
        self.stdout.write(self.style.SUCCESS("\n" + "=" * 50))
        self.stdout.write(
            self.style.SUCCESS(" PROSES SEEDING DATA DUMMY BERHASIL SELESAI ")
        )
        self.stdout.write(self.style.SUCCESS("=" * 50))
        self.stdout.write(
            self.style.WARNING("Berikut kredensial yang dapat digunakan:")
        )
        self.stdout.write(
            "1. Kesiswaan   : username 'kesiswaan1' | password 'password123' | Token: token_kesiswaan1"
        )
        self.stdout.write(
            "2. Guru Piket  : username 'piket1'      | password 'password123' | Token: token_piket1"
        )
        self.stdout.write(
            "3. Wali Kelas  : username 'wali_ipa1'   | password 'password123' | Token: token_wali_ipa1"
        )
        self.stdout.write(
            "4. Sekretaris  : username 'sek_ipa1'    | password 'password123' | Token: token_sek_ipa1"
        )
        self.stdout.write(
            "5. Super Admin : username 'admin'       | password 'admin123'    | Token: token_admin"
        )
        self.stdout.write(self.style.SUCCESS("=" * 50))
