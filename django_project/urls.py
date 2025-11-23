from django.conf import settings
from django.urls import path, re_path, include

from main.admin import admin_site
from main.api import api
from main.views import files, setup, redirect_factory, migrate

urlpatterns = [
    path("admin", redirect_factory('/admin/')),
    path("admin/", admin_site.urls),
    path("api/", api.urls),
    re_path(r"^files/(?P<file_id>[^/]+)/?$", files),
    re_path(r"^setup/?$", setup),
    re_path(r"^migrate/?$", migrate),
    path('silk/', include('silk.urls', namespace='silk'))
]

if not settings.DEBUG:
    from main.views import index, spa_assets, spa_public

    urlpatterns.extend([
        # path untuk serve assets react
        re_path(r"^index.html/?$", index),
        re_path(r"^assets/.*$", spa_assets),
        re_path(r"^public/.*$", spa_public),
        # re_path(r"^registerSW\.js/?$", spa_public),
        # re_path(r"^manifest\.webmanifest/?$", spa_public),
        # re_path(r"^sw\.js/?.*$", spa_public),
        # re_path(r"^workbox-.*\.js/?$", spa_public),

        # serve semua route kecuali prefix static/
        # path ini untuk route spa react
        re_path(r"^(?!static/).*$", spa_public, name = "spa")
    ])
