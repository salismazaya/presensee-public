from django.db import models


class Domain(models.Model):
    owner = models.ForeignKey('main.User', on_delete = models.SET_NULL, null = True, related_name = 'owner_domain')

class BaseQuerySet(models.QuerySet):
    def filter_domain(self, request):
        return self


class BaseManager(models.Manager):
    def get_queryset(self):
        return BaseQuerySet(self.model, using = self._db)
    
    def filter_domain(self, request):
        return self.get_queryset()


class BaseModel(models.Model):
    class Meta:
        abstract = True
    
    objects = BaseManager()
    domain = models.ForeignKey(Domain, on_delete = models.PROTECT, related_name = '%(class)s', null = True)

