from ninja.security import HttpBearer

from main.models import User

from .types import HttpRequest


class AuthBearer(HttpBearer):
    def authenticate(self, request: HttpRequest, token):
        if not token:
            return

        user = User.objects.filter_domain(request).filter(token=token).first()
        return user
