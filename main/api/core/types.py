from django.http import HttpRequest as BaseHttpRequest

from main.models import User


class HttpRequest(BaseHttpRequest):
    auth: User | None
