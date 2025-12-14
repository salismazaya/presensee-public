import json

from django.contrib import admin, messages
# from django.contrib.auth.admin import GroupAdmin as AuthGroupAdmin
from django.contrib.auth.admin import UserAdmin as AuthUserAdmin
from django.db import transaction
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.urls import path
# from django.contrib.auth.forms import UserCreationForm
from django.utils.translation import gettext_lazy as _
from django.views.decorators.csrf import csrf_exempt

# from django.contrib.auth.forms import UserChangeForm
from main.forms import createKelasForm, createUserChangeForm
from main.models import (Absensi, AbsensiSession, Data, Kelas, KunciAbsensi,
                         Siswa, User)


class AdminSite(admin.AdminSite):
    @csrf_exempt
    @transaction.atomic
    def naik_kelas(self, request: HttpRequest):
        data = json.loads(request.body)

        old_kelas_id = data.get("old_kelas_id")
        new_kelas_name = data.get("new_kelas_name")

        if not old_kelas_id or not new_kelas_name:
            return HttpResponse("NOT_OK")

        old_kelas = Kelas.objects.filter_domain(request).filter(pk=old_kelas_id).first()
        if old_kelas is None:
            return HttpResponse("NOT_OK")

        new_kelas = Kelas.original_objects.create(name=new_kelas_name)
        old_kelas.active = False
        old_kelas.save()

        Siswa.objects.filter_domain(request).filter(kelas__pk=old_kelas_id).update(
            kelas_id=new_kelas.pk
        )

        messages.success(
            request,
            "Sukses memindahkan seluruh siswa dari kelas %s ke kelas %s"
            % (old_kelas.name, new_kelas.name),
        )
        return HttpResponse(str(new_kelas.pk))

    def get_urls(self):
        from main.views_import_export import export_absensi, import_siswa

        urls = super().get_urls()
        last_url = urls.pop()

        urls.append(path("naik-kelas/", self.naik_kelas))
        urls.append(path("export-absensi/", export_absensi, name="export_absensi"))
        urls.append(path("import-siswa/", import_siswa, name="import_siswa"))
        urls.append(last_url)

        return urls


class FilterDomainMixin:
    pass


class CustomAuthUserAdmin(FilterDomainMixin, AuthUserAdmin):
    fieldsets = (
        (None, {"fields": ("username", "password", "type")}),
        (_("Personal info"), {"fields": ("first_name", "last_name", "email")}),
        (
            _("Permissions"),
            {
                "fields": (
                    "is_superuser",
                    "is_staff",
                ),
            },
        ),
        # (_('Important dates'), {'fields': ('last_login', 'date_joined')}),
    )
    list_display = ("username", "type", "is_staff", "is_superuser")

    def get_form(self, request, obj=None, **kwargs):
        if obj is None:
            return AuthUserAdmin.get_form(self, request, obj, **kwargs)

        return createUserChangeForm(obj.pk)


class SiswaAdmin(FilterDomainMixin, admin.ModelAdmin):
    search_fields = ("fullname",)
    list_filter = ("kelas",)
    list_display = ("id", "fullname", "kelas")
    actions = ('export_siswa',)

    def get_actions(self, request):
        actions = super().get_actions(request)
        del actions['delete_selected']
        return actions

    def render_change_form(self, request, context, *args, **kwargs):
        context["adminform"].form.fields[
            "kelas"
        ].queryset = Kelas.objects.filter_domain(request).filter(active = True)
        return super().render_change_form(request, context, *args, **kwargs)
    
    @admin.action(description="Export kartu siswa")
    def export_siswa(self, request, queryset):
        siswas = queryset.prefetch_related('kelas')
        data: Data = Data.objects.filter_domain(request).last()

        context = {
            'siswas': siswas,
        }

        if data and data.kop_sekolah:
            context['kop_url'] = data.kop_sekolah.url
        
        return render(request, 'main/kartu.html', context)


class SiswaInlineAdmin(FilterDomainMixin, admin.TabularInline):
    extra = 0
    model = Siswa


class KelasAdmin(FilterDomainMixin, admin.ModelAdmin):
    search_fields = ("name", "wali_kelas__first_name", "wali_kelas__last_name")
    list_filter = ("active",)
    list_display = ("id", "name_", "wali_kelas", "jumlah_siswa", "active")
    ordering = ("-active",)
    inlines = (SiswaInlineAdmin,)
    change_form_template = "admin/kelas_change_form.html"

    def name_(self, obj):
        return str(obj)

    def jumlah_siswa(self, obj):
        return obj.siswas.count()

    def get_form(self, request, obj=None, *args, **kwargs):
        if obj is None:
            return super().get_form(request, obj, *args, **kwargs)

        return createKelasForm(obj.pk)

    def render_change_form(self, request, context, *args, **kwargs):
        context["adminform"].form.fields[
            "wali_kelas"
        ].queryset = User.objects.filter_domain(request)
        context["adminform"].form.fields[
            "sekretaris"
        ].queryset = User.objects.filter_domain(request)

        return super().render_change_form(request, context, *args, **kwargs)


class AbsensiAdmin(FilterDomainMixin, admin.ModelAdmin):
    def kelas(self, obj):
        return obj.siswa.kelas

    list_display = ("id", "date", "siswa", "kelas", "final_status")
    list_filter = (
        "date",
        "siswa__kelas",
    )
    search_fields = ("siswa__fullname", "status")
    readonly_fields = ("created_at", "updated_at")

    def final_status(self, obj):
        final_status = obj.status

        if obj._status == Absensi.StatusChoices.WAIT:
            if final_status != Absensi.StatusChoices.WAIT:
                obj._status = final_status
                obj.save()

        return obj.status.capitalize()

    final_status.short_description = "Status"

    def has_delete_permission(self, request, obj=None):
        return False

    def has_add_permission(self, request):
        return False

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .exclude(final_status=Absensi.StatusChoices.WAIT)
        )

    def render_change_form(self, request, context, *args, **kwargs):
        context["adminform"].form.fields[
            "siswa"
        ].queryset = Siswa.objects.filter_domain(request)
        context["adminform"].form.fields["by"].queryset = User.objects.filter_domain(
            request
        )

        return super().render_change_form(request, context, *args, **kwargs)


class KunciAbsensiAdmin(FilterDomainMixin, admin.ModelAdmin):
    list_filter = ("locked", "kelas")
    list_display = ("kelas", "date", "locked")

    def render_change_form(self, request, context, *args, **kwargs):
        context["adminform"].form.fields[
            "kelas"
        ].queryset = Kelas.objects.filter_domain(request).filter(active = True)
        return super().render_change_form(request, context, *args, **kwargs)


class DataAdmin(FilterDomainMixin, admin.ModelAdmin):
    list_display = ("edit", "nama_sekolah", "nama_aplikasi")

    def edit(self, obj):
        return "Edit"

    edit.short_description = ""

    def has_delete_permission(self, *args, **kwargs):
        return False

    def has_add_permission(self, request):
        if Data.objects.filter_domain(request).exists():
            return False

        return super().has_add_permission(request)


class AbsensiSessionAdmin(FilterDomainMixin, admin.ModelAdmin):
    list_filter = ('senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu')
    list_display = ('id',)

    def render_change_form(self, request, context, *args, **kwargs):
        context["adminform"].form.fields[
            "kelas"
        ].queryset = Kelas.objects.filter_domain(request).filter(active = True)
        return super().render_change_form(request, context, *args, **kwargs)



admin_site = AdminSite()
admin_site.register(User, CustomAuthUserAdmin)
admin_site.register(Absensi, AbsensiAdmin)
admin_site.register(Kelas, KelasAdmin)
admin_site.register(Siswa, SiswaAdmin)
admin_site.register(KunciAbsensi, KunciAbsensiAdmin)
admin_site.register(Data, DataAdmin)
admin_site.register(AbsensiSession, AbsensiSessionAdmin)
