from django.db import models
from django.contrib.auth.models import UserManager

class BaseQuerySet(models.QuerySet):
    _filtered_by_domain = False

    def filter_domain(self, request) -> 'BaseQuerySet':
        self._hints.update({'filtered_by_domain': True})
        return self._chain()
    
    def _fetch_all(self):
        if self._result_cache is None:
            if not self._hints.get('filtered_by_domain'):
                raise ValueError("Must use filter_domain")

        return super()._fetch_all()


class BaseManager(models.Manager):
    def get_queryset(self, filtered_by_domain = None) -> BaseQuerySet:
        return BaseQuerySet(self.model, using = self._db, hints = {'filtered_by_domain': filtered_by_domain})
    
    def filter_domain(self, request):
        return self.get_queryset(filtered_by_domain = True)


class BaseModel(models.Model):
    class Meta:
        abstract = True
        default_manager_name = 'original_objects'
    
    objects: BaseManager = BaseManager()
    original_objects = models.Manager()


class CustomUserManager(BaseManager, UserManager):
    def get_by_natural_key(self, username): 
        from .models import User
        return User.original_objects.get_by_natural_key(username)

    def get(self, pk = None):
        from .models import User
        return User.original_objects.get(pk = pk)