from django.conf import settings
from django.http import HttpResponse

from main.api.api import api

from ..core.types import HttpRequest


@api.get("/ping", auth=None)
def heartbeat(request: HttpRequest):
    return HttpResponse("PONG")


@api.get("/version", auth=None)
def get_version(request: HttpRequest):
    return HttpResponse(settings.PRESENSEE_VERSION)
