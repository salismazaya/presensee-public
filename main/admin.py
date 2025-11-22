from django.contrib import admin
# from django.contrib.auth.admin import GroupAdmin as AuthGroupAdmin
from django.contrib.auth.admin import UserAdmin as AuthUserAdmin
# from django.contrib.auth.forms import UserCreationForm
from django.utils.translation import gettext_lazy as _

# from django.contrib.auth.forms import UserChangeForm
from main.forms import UserCreationForm, createKelasForm, createUserChangeForm
from main.models import Absensi, Kelas, KunciAbsensi, Siswa, User


class AdminSite(admin.AdminSite):
    pass


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
    list_display = ('id', 'name', 'wali_kelas', 'active')
    ordering = ('-active',)
    inlines = (SiswaInlineAdmin,)

    def get_form(self, request, obj = None, *args, **kwargs):
        if obj is None:
            return super().get_form(request, obj, *args, **kwargs)
        
        return createKelasForm(obj.pk)


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