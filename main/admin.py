from django.contrib import admin
# from django.contrib.auth.admin import GroupAdmin as AuthGroupAdmin
from django.contrib.auth.admin import UserAdmin as AuthUserAdmin
# from django.contrib.auth.forms import UserCreationForm
from django.utils.translation import gettext_lazy as _
from django.urls import path
from django.db import transaction
from django.contrib import messages

# from django.contrib.auth.forms import UserChangeForm
from main.forms import UserCreationForm, createKelasForm, createUserChangeForm
from main.models import Absensi, Kelas, KunciAbsensi, Siswa, User
from django.http import HttpRequest, HttpResponse
from django.views.decorators.csrf import csrf_exempt
import json

class AdminSite(admin.AdminSite):
    @csrf_exempt
    @transaction.atomic
    def naik_kelas(self, request: HttpRequest):
        data = json.loads(request.body)

        old_kelas_id = data.get('old_kelas_id')
        new_kelas_name = data.get('new_kelas_name')

        if not old_kelas_id or not new_kelas_name:
            return HttpResponse('NOT_OK')
        
        old_kelas = Kelas.objects.filter(pk = old_kelas_id).first()
        if old_kelas is None:
            return HttpResponse('NOT_OK')
        
        new_kelas = Kelas.objects.create(
            name = new_kelas_name
        )
        old_kelas.active = False
        old_kelas.save()

        Siswa.objects.filter(
            kelas__pk = old_kelas_id
        ).update(
            kelas_id = new_kelas.pk
        )

        messages.success(request, "Sukses memindahkan seluruh siswa dari kelas %s ke kelas %s" % (old_kelas.name, new_kelas.name))
        return HttpResponse(str(new_kelas.pk))

    def get_urls(self):
        from main.views_import_export import export_absensi, import_siswa

        urls = super().get_urls()
        last_url = urls.pop()

        urls.append(path('naik-kelas/', self.naik_kelas))
        urls.append(path('export-absensi/', export_absensi, name = 'export_absensi'))
        urls.append(path('import-siswa/', import_siswa, name = 'import_siswa'))
        urls.append(last_url)

        return urls


class CustomAuthUserAdmin(AuthUserAdmin):
    fieldsets = (
        (None, {'fields': ('username', 'password', 'type')}),
        (_('Personal info'), {'fields': ('first_name', 'last_name', 'email')}),
        (_('Permissions'), {
            'fields': ('is_superuser', 'is_staff',),
        }),
        # (_('Important dates'), {'fields': ('last_login', 'date_joined')}),
    )
    list_display = ('username', 'type', 'is_staff', 'is_superuser')

    def get_form(self, request, obj = None, change = None, **kwargs):
        if obj is None:
            return UserCreationForm
        
        return createUserChangeForm(obj.pk)

class SiswaAdmin(admin.ModelAdmin):
    search_fields = ('fullname',)
    list_filter = ('kelas',)
    list_display = ('id', 'fullname', 'kelas')


class SiswaInlineAdmin(admin.TabularInline):
    extra = 0
    model = Siswa


class KelasAdmin(admin.ModelAdmin):
    search_fields = ('name', "wali_kelas__first_name", "wali_kelas__last_name")
    list_filter = ('active',)
    list_display = ('id', 'name_', 'wali_kelas', 'jumlah_siswa', 'active')
    ordering = ('-active',)
    inlines = (SiswaInlineAdmin,)
    change_form_template = "admin/kelas_change_form.html"

    def name_(self, obj):
        return str(obj)
    
    def jumlah_siswa(self, obj):
        return obj.siswas.count()

    def get_form(self, request, obj = None, *args, **kwargs):
        if obj is None:
            return super().get_form(request, obj, *args, **kwargs)
        
        return createKelasForm(obj.pk)
    
    # def change_view(self, request, object_id, form_url = None, extra_context = {}):
    #     extra_context['is_change'] = True
    #     extra_context['object_id'] = object_id

    #     return super().change_view(request, object_id, form_url, extra_context)


class AbsensiAdmin(admin.ModelAdmin):
    def kelas(self, obj):
        return obj.siswa.kelas

    list_display = ('id', 'date', 'siswa', 'kelas', 'status')
    list_filter = ('date', 'siswa__kelas', 'status')
    search_fields = ('siswa__fullname',)
    readonly_fields = ('created_at', 'updated_at')

    def has_delete_permission(self, request, obj = None):
        return False


class KunciAbsensiAdmin(admin.ModelAdmin):
    list_filter = ("locked", "kelas")
    list_display = ("kelas", "date", "locked")


admin_site = AdminSite()
admin_site.register(User, CustomAuthUserAdmin)
admin_site.register(Absensi, AbsensiAdmin)
admin_site.register(Kelas, KelasAdmin)
admin_site.register(Siswa, SiswaAdmin)
admin_site.register(KunciAbsensi, KunciAbsensiAdmin)