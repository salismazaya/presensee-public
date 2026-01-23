from main.api.api import api
from main.api.core.types import HttpRequest
from main.models import Siswa

from ..schemas import ErrorSchema, SuccessSchema


@api.get("/siswas", response={403: ErrorSchema, 200: SuccessSchema})
def get_siswa(request: HttpRequest):
    if request.auth.type != "guru_piket":
        return 403, {"detail": "Forbidden"}

    results = {}
    siswas: list[Siswa] = Siswa.objects.select_related("kelas")
    for siswa in siswas:
        results[siswa.pk] = {
            "name": siswa.fullname,
            "kelas": siswa.kelas.name,
            "kelas_id": siswa.kelas_id,
        }

    return {"data": results}

