from django.db.models.signals import pre_save, pre_delete
from django.dispatch import receiver
from main.models import Siswa, User
from typing import Union


@receiver(pre_delete, sender=User)
@receiver(pre_delete, sender=Siswa)
def delete_photo_handler(sender, **kwargs):
    """hapus photo ketika instance dihapus"""

    instance = kwargs["instance"]
    if instance.photo:
        # save=True invoke .save()
        instance.photo.delete(save=True)


@receiver(pre_save, sender=User)
@receiver(pre_save, sender=Siswa)
def save_photo_handler(sender, **kwargs):
    """hapus photo sebelumnya saat update photo di instance"""

    # instance terbaru (belum  di-save ke db)
    instance: Siswa = kwargs["instance"]

    instance_model = instance.__class__

    # instance sekarang (yang ada di db)
    current_instance: Union[Siswa, User] = instance_model.objects.filter(
        pk=instance.pk
    ).first()

    # user uncentang photo
    if not instance.photo and current_instance and current_instance.photo:
        # save=False agar tidak invoke .save() dan terjadi rekursif error
        current_instance.photo.delete(save=False)
        return

    # cek current_instance dan current.photo tidak None
    if not current_instance or not current_instance.photo:
        return

    photo_url = instance.photo.url
    current_photo_url = current_instance.photo.url

    if photo_url != current_photo_url:
        # hapus photo lama
        current_instance.photo.delete(save=False)

    # end: photo baru akan disimpan
