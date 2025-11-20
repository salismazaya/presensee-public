from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    class TypeChoices(models.TextChoices):
        WALI_KELAS = 'wali_kelas', 'Wali Kelas'
        KESISWAAN = 'kesiswaan', 'Kesiswaan'
        SEKRETARIS = 'sekretaris', 'Sekretaris'

    is_superuser = models.BooleanField(default = False)
    is_active = models.BooleanField(default = True)
    is_staff = models.BooleanField(default = False)
    type = models.CharField(choices = TypeChoices.choices, max_length = 20, null = True)
    token = models.CharField(max_length = 50, null = True, blank = True, editable = False)

    def __str__(self):
        display_name = self.username
        if self.first_name and self.last_name:
            display_name = "%s %s" % (self.first_name, self.last_name)

        return display_name


class KelasQuerySet(models.QuerySet):
    def own(self, user_id: int):
        return (
            self
            .annotate(
                _type_user = models.Subquery(
                    User.objects.filter(pk = user_id).values('type')[:1],
                    output_field = models.CharField()
                )
            )
            .filter(
                models.Q(wali_kelas__pk = user_id) | \
                models.Q(sekretaris__in = [user_id]) | \
                models.Q(_type_user = User.TypeChoices.KESISWAAN)
            )
        )


class KelasManager(models.Manager):
    def get_queryset(self):
        return KelasQuerySet(self.model, using = self._db)
    
    def own(self, user_id: int):
        return self.get_queryset().own(user_id)


class Kelas(models.Model):
    extra_objects = KelasManager()
    objects = models.Manager()
    
    class Meta:
        verbose_name = verbose_name_plural = "Kelas"    

    name = models.CharField(verbose_name = 'Nama Kelas', max_length = 50, unique = True)
    wali_kelas = models.OneToOneField(User, on_delete = models.PROTECT, null = True, blank = True, related_name = 'wali_kelas')
    sekretaris = models.ManyToManyField(User, related_name = 'sekretaris_kelas', blank = True)
    active = models.BooleanField(default = True, verbose_name = 'Aktif')

    def __str__(self):
        return self.name


class Siswa(models.Model):
    class Meta:
        verbose_name = verbose_name_plural = "Siswa"

    fullname = models.CharField(verbose_name = 'Nama Lengkap', max_length = 50)
    kelas = models.ForeignKey(Kelas, on_delete = models.PROTECT, related_name = 'siswas')

    def __str__(self):
        return self.fullname


class KunciAbsensi(models.Model):
    class Meta:
        verbose_name = verbose_name_plural = "Kunci Absensi"
        unique_together = ('kelas', 'date')
        
    date = models.DateField(default = timezone.now, verbose_name = 'Tanggal')
    kelas = models.ForeignKey(Kelas, on_delete = models.CASCADE)
    locked = models.BooleanField(default = True, verbose_name= 'Kunci')

    def __str__(self):
        return "Lock: %s" % self.kelas


class Absensi(models.Model):
    class Meta:
        unique_together = ('date', 'siswa')
        verbose_name = verbose_name_plural = "Absensi"

    class StatusChoices(models.TextChoices):
        HADIR = 'hadir', 'Hadir'
        SAKIT = 'sakit', 'Sakit'
        IZIN = 'izin', 'Izin'
        ALFA = 'alfa', 'Alfa'
        BOLOS = 'bolos', 'Bolos'

    date = models.DateField(default = timezone.now, verbose_name = 'Tanggal')
    siswa = models.ForeignKey(Siswa, on_delete = models.PROTECT)
    status = models.CharField(max_length = 30, choices = StatusChoices.choices)
    created_at = models.DateTimeField(default = timezone.now, verbose_name = 'Dibuat')
    updated_at = models.DateTimeField(default = timezone.now, verbose_name = 'Diubah')
    by = models.ForeignKey(User, on_delete = models.CASCADE, null = True, verbose_name = 'Oleh')

    def __str__(self):
        return "%s : %s : %s" % (self.date, self.siswa, self.status)

