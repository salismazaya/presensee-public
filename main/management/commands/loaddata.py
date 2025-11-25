from django.core.management import BaseCommand
from main.models import User, Kelas, Absensi, KunciAbsensi, Siswa
from django.db import transaction
import pickle

class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument('input-path', type = str)

    @transaction.atomic
    def execute(self, *args, **options):
        with open(options['input-path'], 'rb') as f:
            input_file = pickle.loads(f.read())

        users = input_file['users']
        kelass = input_file['kelass']
        siswas = input_file['siswas']
        kuncis = input_file['kuncis']
        absensies = input_file['absensies']

        for user in users:
            fields = user['fields']

            del fields['groups']
            del fields['user_permissions']

            User.original_objects.update_or_create(pk = user['pk'], defaults = fields)

        for kelas in kelass:
            fields = kelas['fields']
            sekretariss = fields['sekretaris']
            fields['wali_kelas_id'] = fields['wali_kelas']

            del fields['wali_kelas']
            del fields['sekretaris']

            kelas, _ = Kelas.original_objects.update_or_create(pk = kelas['pk'], defaults = fields)
            
            for sekretaris in sekretariss:
                if not kelas.sekretaris.filter(pk = sekretaris).exists():
                    kelas.sekretaris.add(User.original_objects.get(pk = sekretaris))

        for siswa in siswas:
            fields = siswa['fields']
            fields['kelas_id'] = fields['kelas']
            del fields['kelas']

            Siswa.original_objects.update_or_create(pk = siswa['pk'], defaults = fields)

        for kunci in kuncis:
            fields = kunci['fields']
            kelas_id = fields['kelas']
            date = fields['date']

            del fields['kelas']
            
            KunciAbsensi.original_objects.update_or_create(
                date = date,
                kelas_id = kelas_id,
                defaults = fields
            )

        for absensi in absensies:
            fields = absensi['fields']
            siswa_id = fields['siswa']
            date = fields['date']

            fields['by_id'] = fields['by']

            del fields['siswa']
            del fields['by']
            
            Absensi.original_objects.update_or_create(
                date = date,
                siswa_id = siswa_id,
                defaults = fields
            )

