from django.conf import settings
from django.urls import path, re_path

from main.admin import admin_site
from main.api import api
from main.views import files, ping, setup

urlpatterns = [
    path("admin/", admin_site.urls),
    path("files/<str:file_id>/", files),
    re_path(r"^ping/?$", ping),
    path("api/", api.urls),
    path("setup/", setup),
]

if not settings.DEBUG:
    from main.views import spa_assets, spa_public

    urlpatterns.extend([
        # path untuk serve assets react
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
