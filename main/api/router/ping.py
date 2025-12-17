from django.http import HttpResponse
from ninja.throttling import AnonRateThrottle

from main.api.api import api
from django.conf import settings
from ..core.types import HttpRequest


@api.get("/ping", auth=None, throttle=[AnonRateThrottle("5/s")])
def heartbeat(request: HttpRequest):
    return HttpResponse("PONG")

@api.get("/version", auth=None, throttle=[AnonRateThrottle("5/s")])
def get_version(request: HttpRequest):
    return HttpResponse(settings.PRESENSEE_VERSION)
