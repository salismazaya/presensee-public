from django.conf import settings
from ninja import NinjaAPI
from ninja.throttling import AnonRateThrottle, AuthRateThrottle

from main.api.core.auth import AuthBearer

throttle = []

if not settings.DEBUG:
    throttle.extend(
        [
            # TODO: ganti ke redis. throttle seperti ini tidak akurat jika multi worker
            AnonRateThrottle("1/s"),
            AnonRateThrottle("30/m"),
            AuthRateThrottle("100/m"),
        ]
    )


api = NinjaAPI(
    auth=AuthBearer(),
    docs=False,
    docs_url=False,
    throttle=throttle,
)
