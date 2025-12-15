from django.conf import settings
from redis import Redis


def get_client():
    return Redis.from_url(settings.REDIS_URL)


_client = None


def get_singleton_client():
    global _client

    if _client is None:
        _client = get_client()

    return _client
