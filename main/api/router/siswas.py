from main.api.api import api
from main.api.core.types import HttpRequest
from main.models import Siswa

from django.views.decorators.gzip import gzip_page
from django.http import JsonResponse

from ..schemas import ErrorSchema, SuccessSchema


@api.get("/siswas", response={403: ErrorSchema, 200: SuccessSchema})
@gzip_page
def get_siswa(request: HttpRequest):
    if request.auth.type != "guru_piket":
        return JsonResponse({"detail": "Forbidden"}, status=403)

    results = {}
    siswas: list[Siswa] = Siswa.objects.filter(kelas__active=True).select_related(
        "kelas"
    )
    for siswa in siswas:
        results[siswa.pk] = {
            "name": siswa.fullname,
            "kelas": siswa.kelas.name,
            "kelas_id": siswa.kelas_id,
        }

    return JsonResponse({"data": results})
