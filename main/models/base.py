from django.contrib.auth.models import UserManager
from django.db import models
from django.utils import timezone


class BaseQuerySet(models.QuerySet):
    _filtered_by_domain = False

    def filter_domain(self, request) -> "BaseQuerySet":
        self._hints.update({"filtered_by_domain": True})
        return self._chain()

    def _fetch_all(self):
        if self._result_cache is None:
            if not self._hints.get("filtered_by_domain"):
                raise ValueError("Must use filter_domain")

        return super()._fetch_all()


class BaseManager(models.Manager):
    def get_queryset(self, filtered_by_domain=None) -> BaseQuerySet:
        return BaseQuerySet(
            self.model, using=self._db, hints={"filtered_by_domain": filtered_by_domain}
        )

    def filter_domain(self, request):
        return self.get_queryset(filtered_by_domain=True)


class BaseModel(models.Model):
    class Meta:
        abstract = True
        default_manager_name = "original_objects"

    objects: BaseManager = BaseManager()
    original_objects = models.Manager()


class CustomUserManager(BaseManager, UserManager):
    def get_by_natural_key(self, username):
        from .models import User

        return User.original_objects.get_by_natural_key(username)

    def get(self, pk=None):
        from .models import User

        return User.original_objects.get(pk=pk)


class AbsensiOriginalManager(models.Manager):
    status_expression = models.Case(
        models.When(~models.Q(_status="tunggu"), then=models.F("_status")),
        models.When(wait_expired_at__lte=timezone.now(), then=models.Value("bolos")),
        default=models.Value("tunggu"),
    )

    def get_queryset(self):
        return super().get_queryset().annotate(final_status=self.status_expression)


class AbsensiManager(BaseManager):
    def get_queryset(self, filtered_by_domain=None):
        return BaseManager.get_queryset(self, filtered_by_domain).annotate(
            final_status=AbsensiOriginalManager.status_expression
        )
