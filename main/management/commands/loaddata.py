import pickle

from django.core.management import BaseCommand
from django.db import transaction

from main.models import Absensi, Kelas, KunciAbsensi, Siswa, User


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

            User.objects.update_or_create(pk = user['pk'], defaults = fields)

        for kelas in kelass:
            fields = kelas['fields']
            sekretariss = fields['sekretaris']
            fields['wali_kelas_id'] = fields['wali_kelas']

            del fields['wali_kelas']
            del fields['sekretaris']

            kelas, _ = Kelas.objects.update_or_create(pk = kelas['pk'], defaults = fields)
            
            for sekretaris in sekretariss:
                if not kelas.sekretaris.filter(pk = sekretaris).exists():
                    kelas.sekretaris.add(User.objects.get(pk = sekretaris))

        for siswa in siswas:
            fields = siswa['fields']
            fields['kelas_id'] = fields['kelas']
            del fields['kelas']

            Siswa.objects.update_or_create(pk = siswa['pk'], defaults = fields)

        for kunci in kuncis:
            fields = kunci['fields']
            kelas_id = fields['kelas']
            date = fields['date']

            del fields['kelas']
            
            KunciAbsensi.objects.update_or_create(
                date = date,
                kelas_id = kelas_id,
                defaults = fields
            )


        absensies_obj = []
        for absensi in absensies:
            fields = absensi['fields']
            date = fields['date']

            fields['by_id'] = fields['by']
            fields['siswa_id'] = fields['siswa']

            del fields['siswa']
            del fields['by']

            absensi_obj = Absensi(**fields)

            absensies_obj.append(absensi_obj)
            
        
        Absensi.objects.bulk_create(absensies_obj)

