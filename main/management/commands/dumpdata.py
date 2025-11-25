from django.core.management import BaseCommand
from main.models import User, Kelas, Absensi, KunciAbsensi, Siswa
from django.core import serializers
import pickle

class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument('output-path', type = str)

    def execute(self, *args, **options):
        users = User.original_objects.all()
        kelass = Kelas.original_objects.all()
        siswas = Siswa.original_objects.all()
        kuncis = KunciAbsensi.original_objects.all()
        absensies = Absensi.original_objects.all()

        result = {}
        result['users'] = serializers.serialize('python', users)
        result['kelass'] = serializers.serialize('python', kelass)
        result['siswas'] = serializers.serialize('python', siswas)
        result['kuncis'] = serializers.serialize('python', kuncis)
        result['absensies'] = serializers.serialize('python', absensies)

        for x in result['absensies'] + result['kuncis']:
            # id tabel diatas tidak di-import
            del x['pk']

        output = pickle.dumps(result)

        open(options['output-path'], 'wb').write(output)

