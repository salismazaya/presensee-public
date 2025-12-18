from main.api.api import api
from main.api.core.types import HttpRequest
from main.models import Kelas


@api.get("/me")
def get_me(request: HttpRequest):
    kelas_obj: Kelas = Kelas.objects.own(request.auth.pk).first()
    kelas = None

    if kelas_obj:
        kelas = kelas_obj.pk

    return {
        "data": {
            "username": request.auth.username,
            "type": request.auth.type,
            "kelas": kelas,
        }
    }
