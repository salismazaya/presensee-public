import mimetypes
import os

from django.conf import settings
from django.core.management import call_command
from django.db import connection
from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import redirect, render

# from django.contrib import messages
from main.forms import SetupForm
from main.helpers import redis
# from main.helpers.auth import require_superuser_basic_auth
from main.models import User
from django.contrib.auth import authenticate

def redirect_factory(to: str):
    def inner(*args, **kwargs):
        return redirect(to)
    
    return inner


def files(request: HttpRequest, file_id: str):
    with redis.get_client() as redis_client:
        if not redis_client.exists(file_id):
            response = HttpResponse(content = "File tidak ditemukan atau sudah kadaluarsa")
            response.status_code = 404
            return response
        
        data = redis_client.get(file_id)
    
    filename = data[:100].rstrip().decode()
    mimetype = data[100:200].rstrip().decode()
    content = data[200:]

    response = HttpResponse(content = content, content_type = mimetype)
    response.headers['Content-Disposition'] = 'filename=%s' % filename

    return response


def spa_assets(request: HttpRequest):
    dirs = [
        settings.VITE_ASSETS_DIR,
    ]

    for dir in dirs:
        path = request.get_full_path()
        file_path = dir.joinpath(path.removeprefix("/assets/"))

        try:
            with open(file_path, 'rb') as f:
                mimetype, _ = mimetypes.guess_type(file_path)
                file = f.read()
                response =  HttpResponse(file, content_type = mimetype)

            return response
        except FileNotFoundError:
            continue
    else:
        raise Http404
    

def spa_public(request: HttpRequest):
    dirs = [
        settings.VITE_PUBLIC_DIR
    ]

    for dir in dirs:
        path = request.get_full_path().removeprefix("/public/").removeprefix('/')
        if not '.' in path:
            context = {
                'BASE_API_URL': settings.BASE_URL + '/api'
            }
            return render(request, 'piket.html', context)
        
        file_path =  dir / path
        try:
            if not os.path.exists(file_path):
                continue

            with open(file_path, 'rb') as f:
                mimetype, _ = mimetypes.guess_type(file_path)
                file = f.read()
                response =  HttpResponse(file, content_type = mimetype)

            return response
        except (FileNotFoundError, IsADirectoryError):
            continue
    else:
        raise Http404
    

def index(request: HttpRequest):
    context = {
        'BASE_API_URL': settings.BASE_URL + '/api'
    }
    return render(request, 'piket.html', context)    


def setup(request: HttpRequest):
    is_db_exists = "main_absensi" in connection.introspection.table_names()

    if is_db_exists:
        response = HttpResponse(content = "Setup sudah dilakukan")
        response.status_code = 403
        return response
        
    form = SetupForm(request.POST or None)

    if request.method == 'POST':
        if form.is_valid():
            call_command("migrate") # python manage.py migrate

            user = User(username = form.cleaned_data['username'])
            user.set_password(form.cleaned_data['password'])
            user.is_staff = True
            user.is_superuser = True
            user.save()

            # messages.success(request, "Silakan login.")
            return redirect('/admin')

    return render(request, 'main/setup.html', {'form': form})


def migrate(request: HttpRequest):
    if request.method == 'GET':
        context = {}
        context['text'] = request.GET.get('text') or ''

        return render(request, 'main/migrate_login.html', context)
    
    user = authenticate(request, username = request.POST['username'], password = request.POST['password'])
    if not user or not user.is_superuser:
        return redirect('/migrate?text=Ditolak')
    
    call_command("migrate")
    return redirect('/migrate?text=Selesai')


    
