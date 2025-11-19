from django.conf import settings
from redis import Redis


def get_client():
    return Redis.from_url(settings.REDIS_URL)