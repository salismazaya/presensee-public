import json

from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as AuthUserAdmin
from django.db import transaction
from django.db.models import OuterRef, Q, Subquery
from django.forms import model_to_dict
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.urls import path
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _
from django.views.decorators.csrf import csrf_exempt

from main.forms import (
    AbsensiSessionForm,
    UserCreationForm,
    createKelasForm,
    createUserChangeForm,
)
from main.models import Absensi, AbsensiSession, Data, Kelas, KunciAbsensi, Siswa, User


class AdminSite(admin.AdminSite):
    @csrf_exempt
    @transaction.atomic
    def naik_kelas(self, request: HttpRequest):
        data = json.loads(request.body)

        old_kelas_id = data.get("old_kelas_id")
        new_kelas_name = data.get("new_kelas_name")

        if not old_kelas_id or not new_kelas_name:
            return HttpResponse("NOT_OK")

        old_kelas = Kelas.objects.filter(pk=old_kelas_id).first()
        if old_kelas is None:
            return HttpResponse("NOT_OK")

        new_kelas = Kelas.objects.create(name=new_kelas_name)
        old_kelas.active = False
        old_kelas.save()

        Siswa.objects.filter(kelas__pk=old_kelas_id).update(kelas_id=new_kelas.pk)

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
        (
            "Umum",
            {
                "fields": (
                    "id",
                    "full_name",
                    "username",
                    "password",
                    "type",
                    "kelas",
                    "photo",
                )
            },
        ),
        # (_("Personal info"), {"fields": ("first_name", "last_name")}),
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
    list_display = (
        "display_name",
        "type",
    )
    change_form_template = "admin/user_change_form.html"

    def display_name(self, obj):
        return obj.display_name

    display_name.short_description = "Nama"

    def get_form(self, request, obj=None, **kwargs):
        if obj is None:
            return UserCreationForm

        return createUserChangeForm(obj.pk)

    def changeform_view(
        self, request, object_id=None, form_url=None, extra_context=None
    ):
        extra_context = extra_context or {}

        wali_kelas_queryset = User.objects.annotate(
            kelas_id=Subquery(
                Kelas.objects.filter(
                    wali_kelas__pk=OuterRef("pk"),
                )[:1].values("id"),
            )
        ).filter(type=User.TypeChoices.WALI_KELAS)

        sekretariss_queryset = User.objects.annotate(
            kelas_id=Subquery(
                Kelas.objects.filter(
                    sekretaris__pk__in=[OuterRef("pk")],
                )[:1].values("id"),
            )
        ).filter(type=User.TypeChoices.SEKRETARIS)

        sekretariss = []

        for sekretaris in sekretariss_queryset:
            sekretariss.append(
                {
                    **model_to_dict(sekretaris, fields=["id", "username"]),
                    "name": sekretaris.display_name,
                    "kelas_id": sekretaris.kelas_id,
                }
            )

        extra_context["sekretariss"] = json.dumps(sekretariss)

        wali_kelass = []
        for wali_kelas in wali_kelas_queryset:
            wali_kelass.append(
                {
                    **model_to_dict(wali_kelas, fields=["id", "username"]),
                    "name": wali_kelas.display_name,
                    "kelas_id": wali_kelas.kelas_id,
                }
            )

        extra_context["wali_kelass"] = json.dumps(wali_kelass)

        kelass_queryset = Kelas.objects.filter(active=True).prefetch_related(
            "sekretaris"
        )

        kelass = []
        for kelas in kelass_queryset:
            kelass.append(
                {
                    **model_to_dict(kelas, fields=["id", "name"]),
                    "sekretaris_ids": [s.id for s in kelas.sekretaris.all()],
                    "wali_kelas_id": kelas.wali_kelas_id,
                }
            )

        extra_context["kelass"] = json.dumps(kelass)

        return super().changeform_view(request, object_id, form_url, extra_context)

    def clear_role(self, user: User):
        Kelas.objects.filter(wali_kelas__pk=user.pk).update(wali_kelas=None)
        for k in Kelas.objects.filter(sekretaris__pk__in=[user.pk]):
            k.sekretaris.remove(user)

    @transaction.atomic
    def save_model(self, request, obj, form, change):
        def rv_func():
            return super(CustomAuthUserAdmin, self).save_model(
                request, obj, form, change
            )

        if not change:
            return rv_func()

        kelas_id = form.cleaned_data.get("kelas")
        user_type = form.cleaned_data.get("type")
        user_id = obj.pk

        if not kelas_id or not user_type:
            return rv_func()

        kelas: Kelas = Kelas.objects.filter(pk=kelas_id).first()
        if kelas is None:
            return rv_func()

        if user_type == User.TypeChoices.WALI_KELAS:
            self.clear_role(obj)

            kelas.wali_kelas_id = user_id
            kelas.save()

        elif user_type == User.TypeChoices.SEKRETARIS:
            is_user_sekretaris = kelas.sekretaris.filter(pk=user_id).exists()
            if not is_user_sekretaris:
                self.clear_role(obj)
                kelas.sekretaris.add(obj)
                kelas.save()

        else:
            self.clear_role(obj)

        return rv_func()


class SiswaAdmin(FilterDomainMixin, admin.ModelAdmin):
    search_fields = ("fullname",)
    list_filter = ("kelas",)
    list_display = ("id", "fullname", "kelas")
    actions = ("export_siswa",)

    def get_actions(self, request):
        actions = super().get_actions(request)
        del actions["delete_selected"]
        return actions

    def render_change_form(self, request, context, *args, **kwargs):
        context["adminform"].form.fields["kelas"].queryset = Kelas.objects.filter(
            active=True
        )
        return super().render_change_form(request, context, *args, **kwargs)

    @admin.action(description="Export kartu siswa")
    def export_siswa(self, request, queryset):
        siswas = queryset.prefetch_related("kelas")

        if siswas.count() > 100:
            messages.error(request, "Hanya bisa memproses maksimal 100 siswa")
            return

        data: Data = Data.objects.last()

        context = {
            "siswas": siswas,
        }

        if data and data.kop_sekolah:
            context["kop_url"] = data.kop_sekolah.url

        return render(request, "main/kartu.html", context)


class SiswaInlineAdmin(FilterDomainMixin, admin.TabularInline):
    extra = 0
    model = Siswa


class KelasAdmin(FilterDomainMixin, admin.ModelAdmin):
    search_fields = ("name", "wali_kelas__first_name", "wali_kelas__last_name")
    list_filter = ("active",)
    fields = ("name",)
    list_display = ("id", "name_", "wali_kelas_", "sekretaris_", "active")
    ordering = ("-active",)
    inlines = (SiswaInlineAdmin,)
    change_form_template = "admin/kelas_change_form.html"

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related("wali_kelas")

    def name_(self, obj):
        return str(obj)

    def wali_kelas_(self, obj):
        if obj.wali_kelas is None:
            return "-"

        return format_html(
            f'<a href="/admin/main/user/{obj.wali_kelas_id}/change/">{obj.wali_kelas.display_name[:15]}</a>'
        )

    def sekretaris_(self, obj: Kelas):
        output = []

        for sekretaris in obj.sekretaris.all():
            output.append(
                f'<a href="/admin/main/user/{sekretaris.pk}/change/" target="_blank">{sekretaris.display_name[:15]}</a>'
            )

        output = ", ".join(output)
        return format_html(output)

    def get_form(self, request, obj=None, *args, **kwargs):
        if obj is None:
            return super().get_form(request, obj, *args, **kwargs)

        return createKelasForm(obj.pk)

    def render_change_form(self, request, context, *args, **kwargs):
        # context["adminform"].form.fields["wali_kelas"].queryset = User.objects.filter(
        #     type=User.TypeChoices.WALI_KELAS
        # )
        # context["adminform"].form.fields["sekretaris"].queryset = User.objects.filter(
        #     type=User.TypeChoices.SEKRETARIS
        # )

        return super().render_change_form(request, context, *args, **kwargs)


class AbsensiAdmin(FilterDomainMixin, admin.ModelAdmin):
    def kelas(self, obj):
        return obj.siswa.kelas

    list_display = ("id", "date", "siswa", "kelas", "final_status_")
    list_filter = (
        "date",
        "siswa__kelas",
    )
    search_fields = ("siswa__fullname", "status")
    readonly_fields = ("created_at", "updated_at")

    def final_status_(self, obj):
        final_status = obj.status

        if obj._status == Absensi.StatusChoices.WAIT:
            if final_status != Absensi.StatusChoices.WAIT:
                obj._status = final_status
                obj.save()

        return obj.status.capitalize()

    final_status_.short_description = "Status"

    def has_delete_permission(self, request, obj=None):
        return False

    def has_add_permission(self, request):
        return False

    def get_queryset(self, request):
        return (
            super().get_queryset(request)
            # .exclude(final_status=Absensi.StatusChoices.WAIT)
            # WAIT jangan di exclude karena akan di cek di line 180an
        )

    def render_change_form(self, request, context, *args, **kwargs):
        context["adminform"].form.fields["siswa"].queryset = Siswa.objects.all()
        context["adminform"].form.fields["by"].queryset = User.objects.all()

        return super().render_change_form(request, context, *args, **kwargs)


class KunciAbsensiAdmin(FilterDomainMixin, admin.ModelAdmin):
    list_filter = ("locked", "kelas")
    list_display = ("id", "kelas", "date", "locked")

    def render_change_form(self, request, context, *args, **kwargs):
        context["adminform"].form.fields["kelas"].queryset = Kelas.objects.filter(
            active=True
        )
        return super().render_change_form(request, context, *args, **kwargs)


class DataAdmin(FilterDomainMixin, admin.ModelAdmin):
    list_display = ("edit", "nama_sekolah", "nama_aplikasi")

    def edit(self, obj):
        return "Edit"

    edit.short_description = ""

    def has_delete_permission(self, *args, **kwargs):
        return False

    def has_add_permission(self, request):
        if Data.objects.exists():
            return False

        return super().has_add_permission(request)


class AbsensiSessionAdmin(FilterDomainMixin, admin.ModelAdmin):
    list_filter = ("senin", "selasa", "rabu", "kamis", "jumat", "sabtu")
    list_display = ("id_", "kelas_", "hari")
    form = AbsensiSessionForm

    def id_(self, obj):
        return obj.pk.hex[:8]

    id_.short_description = ""

    def hari(self, obj):
        result = []
        for x in ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu"]:
            if getattr(obj, x):
                result.append(x.capitalize())

        return ", ".join(result)

    def kelas_(self, obj):
        kelas_names = []
        for x in obj.kelas.all():
            kelas_names.append(x.name)

        return ", ".join(kelas_names)

    def render_change_form(self, request, context, *args, **kwargs):
        context["adminform"].form.fields["kelas"].queryset = Kelas.objects.filter(
            active=True
        )
        return super().render_change_form(request, context, *args, **kwargs)

    def save_msodel(self, request, obj: AbsensiSession, form, change):
        hari_query = Q(pk__isnull=False)
        for hari in ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu"]:
            exists = getattr(obj, hari)
            if exists:
                hari_query |= Q(**{hari: True})

        kelass = obj.kelas.all()
        for kelas in kelass:
            is_bentrok = (
                AbsensiSession.objects.filter(
                    kelas__contains=[kelas.pk],
                )
                .filter(hari_query)
                .exists()
            )
            if is_bentrok:
                pass

        return super().save_model(request, obj, form, change)


admin_site = AdminSite()
admin_site.register(User, CustomAuthUserAdmin)
admin_site.register(Absensi, AbsensiAdmin)
admin_site.register(Kelas, KelasAdmin)
admin_site.register(Siswa, SiswaAdmin)
admin_site.register(KunciAbsensi, KunciAbsensiAdmin)
admin_site.register(Data, DataAdmin)
admin_site.register(AbsensiSession, AbsensiSessionAdmin)
