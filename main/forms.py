from django import forms
from django.contrib.auth.forms import UserChangeForm as BaseUserChangeForm
from django.core.exceptions import ValidationError

from main.models import Kelas, User


def createKelasForm(kelas_id: int):
    class KelasForm(forms.ModelForm):
        class Meta:
            model = Kelas
            fields = '__all__'
        
        def clean_wali_kelas(self):
            wali_kelas = self.cleaned_data.get('wali_kelas')
            if wali_kelas:
                if wali_kelas.type != User.TypeChoices.WALI_KELAS:
                    raise ValidationError(f'type user {wali_kelas.username} bukan wali kelas')

                kelas_wali_kelas = Kelas.objects.exclude(pk = kelas_id).filter(wali_kelas__pk = wali_kelas.pk).first()
                if kelas_wali_kelas:
                    raise ValidationError(f'{wali_kelas.username} sedang menjadi wali kelas di {kelas_wali_kelas.name}')
                
            return wali_kelas

        def clean_sekretaris(self):
            sekretariss = self.cleaned_data.get('sekretaris', [])

            for sekretaris in sekretariss:
                if sekretaris.type != User.TypeChoices.SEKRETARIS:
                    raise ValidationError(f'type user {sekretaris.username} bukan sekretaris')

                sekretaris_kelas = Kelas.objects.exclude(pk = kelas_id).filter(sekretaris__in = [sekretaris.pk]).first()
                if sekretaris_kelas:
                    raise ValidationError(f'{sekretaris.username} sedang menjadi sekretaris di {sekretaris_kelas.name}')

            return sekretariss

    
    return KelasForm


def createUserChangeForm(user_id: int):
    class UserChangeForm(BaseUserChangeForm):        
        class Meta:
            model = User
            fields = '__all__'

        is_superuser = forms.BooleanField(label = 'Apakah admin?', required = False)
        is_staff = forms.BooleanField(label = 'Boleh login admin panel?', required = False)

        def clean_type(self):
            current_obj = User.objects.get(pk = user_id)

            new_type = self.cleaned_data.get('type')
            if current_obj.type != new_type:
                kelas_wali_kelas = Kelas.objects.filter(wali_kelas__pk = user_id).first()
                if new_type != "wali_kelas" and kelas_wali_kelas:
                    raise ValidationError(f'{current_obj.username} sedang menjadi wali kelas di {kelas_wali_kelas.name}')
                
                kelas_sekretaris = Kelas.objects.filter(sekretaris__in = [user_id]).first()
                if new_type != "sekretaris" and kelas_sekretaris:
                    raise ValidationError(f'{current_obj.username} sedang menjadi sekretaris di {kelas_sekretaris.name}')

            return new_type


    return UserChangeForm


class SetupForm(forms.Form):
    username = forms.CharField(
        label="Username",
        widget=forms.TextInput(attrs={
            'placeholder': 'Masukan username',
            'class': 'form-control'
        })
    )


    confirm_password = forms.CharField(
        label="Konfirmasi Password",
        widget=forms.PasswordInput(attrs={
            'placeholder': 'Ulangi password',
            'class': 'form-control'
        })
    )
    
    password = forms.CharField(
        label="Password",
        widget=forms.PasswordInput(attrs={
            'placeholder': 'Masukkan password',
            'class': 'form-control'
        })
    )

    class Meta:
        model = User
        fields = ['username', 'password', 'confirm_password']
        widgets = {
            'username': forms.TextInput(attrs={
                'placeholder': 'Masukkan username',
                'class': 'form-control'
            }),
        }

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        confirm_password = cleaned_data.get("confirm_password")

        # 1. Cek apakah password cocok
        if password and confirm_password and password != confirm_password:
            # Menambahkan error spesifik ke field 'confirm_password'
            self.add_error('confirm_password', "Password tidak cocok.")

        # 2. Cek panjang password (opsional, bisa juga via settings.py)
        if password and len(password) < 6:
            self.add_error('password', "Password minimal 6 karakter.")

        return cleaned_data