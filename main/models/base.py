from django.contrib.auth.models import UserManager
from django.db import models
from django.utils import timezone


class BaseQuerySet(models.QuerySet):
    pass


class BaseManager(models.Manager):
    pass


class BaseModel(models.Model):
    class Meta:
        abstract = True

    objects: BaseManager = BaseManager()


class CustomUserManager(BaseManager, UserManager):
    pass


class AbsensiOriginalManager(models.Manager):
    status_expression = models.Case(
        models.When(~models.Q(_status="tunggu"), then=models.F("_status")),
        models.When(wait_expired_at__lte=timezone.now(), then=models.Value("bolos")),
        default=models.Value("tunggu"),
    )

    def get_queryset(self):
        return super().get_queryset().annotate(final_status=self.status_expression)


class AbsensiManager(BaseManager):
    def get_queryset(self):
        return BaseManager.get_queryset(self).annotate(
            final_status=AbsensiOriginalManager.status_expression
        )
