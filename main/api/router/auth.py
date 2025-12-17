from django.utils.crypto import get_random_string

from main.api.api import api
from main.api.core.types import HttpRequest
from main.models import User

from ..schemas import (ChangePasswordSchema, ErrorSchema, LoginSchema,
                       SuccessSchema)


@api.post("/login", auth=None, response={403: ErrorSchema, 200: SuccessSchema})
def login(request: HttpRequest, data: LoginSchema):
    user = User.objects.filter_domain(request).filter(username=data.username).first()

    if user is None:
        return 403, {"detail": "Username/password salah"}

    if not user.check_password(data.password):
        return 403, {"detail": "Username/password salah"}

    user.token = get_random_string(20)
    user.save()

    return 200, {
        "data": {"token": user.token, "username": user.username, "type": user.type}
    }


@api.post("/change-password", response={403: ErrorSchema, 200: SuccessSchema})
def change_password(request: HttpRequest, data: ChangePasswordSchema):
    if not request.auth.check_password(data.old_password):
        return 403, {"detail": "Password salah!"}

    request.auth.set_password(data.new_password)
    request.auth.save()
    return 200, {"data": {"success": True}}
