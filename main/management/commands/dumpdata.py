import pickle

from django.core import serializers
from django.core.management import BaseCommand

from main.models import Absensi, Kelas, KunciAbsensi, Siswa, User


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument("output-path", type=str)

    def execute(self, *args, **options):
        users = User.objects.all()
        kelass = Kelas.objects.all()
        siswas = Siswa.objects.all()
        kuncis = KunciAbsensi.objects.all()
        absensies = Absensi.objects.all()

        result = {}
        result["users"] = serializers.serialize("python", users)
        result["kelass"] = serializers.serialize("python", kelass)
        result["siswas"] = serializers.serialize("python", siswas)
        result["kuncis"] = serializers.serialize("python", kuncis)
        result["absensies"] = serializers.serialize("python", absensies)

        for x in result["absensies"] + result["kuncis"]:
            # id tabel diatas tidak di-import
            del x["pk"]

        for x in result["siswas"] + result["users"]:
            if x.get("photo"):
                del x["photo"]

        output = pickle.dumps(result)

        open(options["output-path"], "wb").write(output)
