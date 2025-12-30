from pathlib import Path
from tempfile import NamedTemporaryFile

import pdfkit
from bs4 import BeautifulSoup
from django.utils import timezone

from main.helpers.humanize import localize_month_to_string
from main.models import Absensi, Kelas, Siswa
from django.db.models import F

HELPERS_DIR = Path(__file__).parent

html_content = open(HELPERS_DIR / 'pdf.html').read()

options = {
    "page-size": "A4",
    "orientation": "Landscape",
    "margin-top": "5mm",
    "margin-bottom": "5mm",
    "margin-left": "5mm",
    "margin-right": "5mm",
}


def generate_pdf(kelas: Kelas, month: int, year: int):
    if year <= 99:
        year += 2000
        
    soup = BeautifulSoup(html_content, 'html.parser')

    soup.find('span', attrs = {'id': 'kelas'}).string = kelas.name

    now = timezone.now()
    now_str = now.strftime('%d/%m/%Y %H:%M')

    month_str = "%s %s" % (localize_month_to_string(month), year)

    soup.find('span', attrs = {'id': 'tanggal_dibuat'}).string = now_str
    soup.find('span', attrs = {'id': 'bulan'}).string = month_str

    siswas = Siswa.objects.filter(kelas__pk = kelas.pk).order_by('fullname')

    for h, siswa in enumerate(siswas, start = 1):
        background_color = 'odd-color'

        siswa_id = siswa.pk
        siswa_name = siswa.fullname[:30].upper()
        siswa_absensies_queryset = Absensi.objects.filter(
            siswa__pk = siswa_id
        ).filter(
            date__year = year
        ).filter(
            date__month = month
        ).annotate(
            status = F('_status')
        )

        siswa_alfa_total = siswa_absensies_queryset.filter(status = Absensi.StatusChoices.ALFA).count()
        siswa_sakit_total = siswa_absensies_queryset.filter(status = Absensi.StatusChoices.SAKIT).count()
        siswa_izin_total = siswa_absensies_queryset.filter(status = Absensi.StatusChoices.IZIN).count()
        siswa_bolos_total = siswa_absensies_queryset.filter(status = Absensi.StatusChoices.BOLOS).count()   

        if h % 2 == 0:
            background_color = 'even-color'

        tr_tag = soup.new_tag('tr', attrs = {'class': background_color})
        no_tag = soup.new_tag('td', string = str(h), attrs = {'class': 'number-point ' + background_color})
        name_tag = soup.new_tag('td', string = siswa_name, attrs = {'class': background_color})

        alfa_total_tag = soup.new_tag('td', string = str(siswa_alfa_total), attrs = {'class': 'rekap-point'})
        sakit_total_tag = soup.new_tag('td', string = str(siswa_izin_total), attrs = {'class': 'rekap-point'})
        izin_total_tag = soup.new_tag('td', string = str(siswa_sakit_total), attrs = {'class': 'rekap-point'})
        bolos_total_tag = soup.new_tag('td', string = str(siswa_bolos_total), attrs = {'class': 'rekap-point'})

        tr_tag.append(no_tag)
        tr_tag.append(name_tag)
        tr_tag.append(alfa_total_tag)
        tr_tag.append(izin_total_tag)
        tr_tag.append(sakit_total_tag)
        tr_tag.append(bolos_total_tag)

        keren = dict([(a.date.day, a) for a in siswa_absensies_queryset])

        # for absensi in siswa_absensies_queryset:
        for tanggal in range(1,32):
            absensi = keren.get(tanggal)
            absensi_string = ''

            if absensi:
                absensi_status = absensi.status
                if absensi_status == Absensi.StatusChoices.ALFA:
                    absensi_string = 'A'
                elif absensi_status == Absensi.StatusChoices.BOLOS:
                    absensi_string = 'B'
                elif absensi_status == Absensi.StatusChoices.HADIR:
                    absensi_string = '.'
                elif absensi_status == Absensi.StatusChoices.IZIN:
                    absensi_string = 'I'
                elif absensi_status == Absensi.StatusChoices.SAKIT:
                    absensi_string = 'S'

            tr_tag.append(
                soup.new_tag('td', string = absensi_string, attrs = {'class': 'absen-point ' + background_color})        
            )

        soup.find('table').append(tr_tag)


    # pdf_file = NamedTemporaryFile('wb', suffix = '.pdf') WINDOWS ISSUE
    pdf_file = NamedTemporaryFile('wb', suffix = '.pdf', delete = False)

    try:
        html_result = soup.prettify()

        pdfkit.from_string(html_result, pdf_file.name, options = options, cover_first = True)

        with open(pdf_file.name, 'rb') as f:
            return f.read()
    finally:
        pdf_file.close()
        pdf_file.delete()
