import os
import uuid
from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

from .base import (AbsensiManager, BaseManager, BaseModel, BaseQuerySet,
                   CustomUserManager)


def random_filename(instance, filename):
    ext = os.path.splitext(filename)[1]
    return f"uploads/{uuid.uuid4().hex}{ext}"


class User(BaseModel, AbstractUser):
    objects: CustomUserManager = CustomUserManager()
    
    class Meta:
        verbose_name = verbose_name_plural = "Pengguna"

    class TypeChoices(models.TextChoices):
        WALI_KELAS = "wali_kelas", "Wali Kelas"
        KESISWAAN = "kesiswaan", "Kesiswaan"
        SEKRETARIS = "sekretaris", "Sekretaris"
        GURU_PIKET = "guru_piket", "Guru Piket"

    is_superuser = models.BooleanField(default=False, verbose_name="Apakah admin?")
    is_active = models.BooleanField(default=True, editable=False)
    is_staff = models.BooleanField(default=False, verbose_name="Akses admin panel?")
    type = models.CharField(choices=TypeChoices.choices, max_length=20, null=True)
    token = models.CharField(max_length=50, null=True, blank=True, editable=False)
    date_joined = models.DateTimeField(default=timezone.now, verbose_name="Daftar pada")
    photo = models.ImageField(null=True, blank=True, upload_to=random_filename)

    def __str__(self):
        display_name = self.username
        if self.first_name and self.last_name:
            display_name = "%s %s" % (self.first_name, self.last_name)

        return display_name


class KelasQuerySet(BaseQuerySet):
    def own(self, user_id: int):
        return self.annotate(
            _type_user=models.Subquery(
                User.objects.filter(pk=user_id).values("type")[:1],
                output_field=models.CharField(),
            )
        ).filter(
            models.Q(wali_kelas__pk=user_id)
            | models.Q(sekretaris__in=[user_id])
            | models.Q(_type_user=User.TypeChoices.KESISWAAN)
        )


class KelasManager(BaseManager):
    def get_queryset(self, filtered_by_domain=None):
        return KelasQuerySet(
            self.model, using=self._db, hints={"filtered_by_domain": filtered_by_domain}
        )

    def own(self, user_id: int):
        return self.get_queryset().own(user_id)


class Kelas(BaseModel):
    extra_objects = KelasManager()
    objects = KelasManager()

    class Meta:
        verbose_name = verbose_name_plural = "Kelas"

    name = models.CharField(verbose_name="Nama Kelas", max_length=50, unique=True)
    wali_kelas = models.OneToOneField(
        User, on_delete=models.PROTECT, null=True, blank=True, related_name="wali_kelas"
    )
    sekretaris = models.ManyToManyField(
        User, related_name="sekretaris_kelas", blank=True
    )
    active = models.BooleanField(default=True, verbose_name="Aktif")

    def __str__(self):
        display_name = self.name

        if not self.active:
            display_name += " (TIDAK AKTIF)"

        return display_name


class Siswa(BaseModel):
    class Meta:
        verbose_name = verbose_name_plural = "Siswa"

    fullname = models.CharField(verbose_name="Nama Lengkap", max_length=50)
    kelas = models.ForeignKey(Kelas, on_delete=models.PROTECT, related_name="siswas")
    nis = models.CharField(max_length=20, null=True, blank=True)
    nisn = models.CharField(max_length=20, null=True, blank=True)
    photo = models.ImageField(null=True, blank=True, upload_to=random_filename)

    def __str__(self):
        return self.fullname


class KunciAbsensi(BaseModel):
    class Meta:
        verbose_name = verbose_name_plural = "Kunci Absensi"
        unique_together = ("kelas", "date")

    date = models.DateField(default=timezone.now, verbose_name="Tanggal")
    kelas = models.ForeignKey(Kelas, on_delete=models.CASCADE)
    locked = models.BooleanField(default=True, verbose_name="Kunci")

    def __str__(self):
        return "Lock: %s" % self.kelas


class Absensi(BaseModel):
    class Meta:
        unique_together = ("date", "siswa")
        verbose_name = verbose_name_plural = "Absensi"

        constraints = [
            models.CheckConstraint(
                check=~models.Q(_status="tunggu")
                | models.Q(wait_expired_at__isnull=False),
                name="wait_expired_at_must_not_null_while_status_is_wait",
            )
        ]

    objects = AbsensiManager()

    class SafeStatusChoices(models.TextChoices):
        HADIR = "hadir", "Hadir"
        SAKIT = "sakit", "Sakit"
        IZIN = "izin", "Izin"
        ALFA = "alfa", "Alfa"
        BOLOS = "bolos", "Bolos"

    class StatusChoices(models.TextChoices):
        HADIR = "hadir", "Hadir"
        SAKIT = "sakit", "Sakit"
        IZIN = "izin", "Izin"
        ALFA = "alfa", "Alfa"
        BOLOS = "bolos", "Bolos"
        WAIT = "tunggu", "Menunggu"

    date = models.DateField(default=timezone.now, verbose_name="Tanggal")
    siswa = models.ForeignKey(Siswa, on_delete=models.PROTECT)
    created_at = models.DateTimeField(default=timezone.now, verbose_name="Dibuat")
    updated_at = models.DateTimeField(default=timezone.now, verbose_name="Diubah")
    wait_expired_at = models.DateTimeField(editable=False, null=True)
    by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, verbose_name="Oleh"
    )
    _status = models.CharField(
        max_length=30,
        choices=SafeStatusChoices.choices,
        null=True,
        verbose_name="Status",
    )

    def __str__(self):
        return "%s : %s : %s" % (self.date, self.siswa, self.status)

    @property
    def status(self):
        return getattr(self, "final_status", self._status)

    @status.setter
    def status(self, value):
        self._status = value


class AbsensiSession(BaseModel):
    class Meta:
        verbose_name = verbose_name_plural = "Jadwal Absensi (QR)"

    id = models.UUIDField(primary_key=True, editable=False, default=uuid.uuid4)
    senin = models.BooleanField(default=False)
    selasa = models.BooleanField(default=False)
    rabu = models.BooleanField(default=False)
    kamis = models.BooleanField(default=False)
    jumat = models.BooleanField(default=False)
    sabtu = models.BooleanField(default=False)

    jam_masuk = models.TimeField(verbose_name="Jam Masuk (Absen Dimulai)")
    jam_masuk_toleransi = models.DurationField(
        verbose_name="Waktu Toleransi Masuk", default=timedelta(minutes=15)
    )
    jam_keluar_mulai_absen = models.TimeField(
        null=True, blank=True, verbose_name="Jam Pulang (Absen Pulang Dimulai)"
    )
    jam_keluar = models.TimeField(verbose_name="Jam Keluar")

    kelas = models.ManyToManyField(Kelas, related_name="jadwal_kelas")

    @property
    def safe_jam_keluar(self):
        """mendapatkan jam_keluar_mulai_absen. jika null return jam_keluar"""
        rv = self.jam_keluar_mulai_absen
        if rv is None:
            rv = self.jam_keluar

        return rv


class Data(BaseModel):
    class Meta:
        verbose_name = verbose_name_plural = "Data Sekolah"

    nama_sekolah = models.CharField(max_length=100)
    logo_sekolah = models.ImageField(null=True, blank=True)
    deskripsi_sekolah = models.TextField(null=True, blank=True)
    kop_sekolah = models.ImageField(
        null=True,
        blank=True,
        help_text="* Gunakan gambar format webp untuk kop sekolah",
    )
    nama_aplikasi = models.CharField(max_length=50, default="Presensee")
