from django.db import models


class BaseQuerySet(models.QuerySet):
    def filter_domain(self, request):
        # ini adalah filter. logika sebenernya di repo private
        # ini dibutuhkan agar kedua repo tetap kompatibel
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
