"""
Formulario de recepcionistas (personal del local · Edson).

Igual que una especialista, una recepcionista es un Usuario del repositorio común, pero con rol
Recepcionista: tiene local, pero no servicios, cargo ni comisión. Antes solo se creaban en /admin/.
"""
from django import forms
from django.contrib.auth.password_validation import validate_password

from usuarios.models import Usuario


class RecepcionistaForm(forms.ModelForm):
    clave = forms.CharField(
        label="Clave inicial", widget=forms.PasswordInput, required=False,
        help_text="Con esta clave la recepcionista entra al sistema.",
    )

    class Meta:
        model = Usuario
        fields = ["first_name", "last_name", "email", "local"]
        labels = {"first_name": "Nombre", "last_name": "Apellido", "email": "Correo", "local": "Local"}
        error_messages = {"email": {"unique": "Ese correo ya lo usa otra persona del sistema."}}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.es_nueva = self.instance.pk is None
        for campo in ("first_name", "last_name", "local"):
            self.fields[campo].required = True     # en el modelo son opcionales; para una recepcionista no
        if self.es_nueva:
            self.fields["clave"].required = True
        else:
            del self.fields["clave"]               # al editar no se pide clave

    def clean_email(self):
        return (self.cleaned_data.get("email") or "").strip().lower()

    def clean_clave(self):
        clave = self.cleaned_data.get("clave")
        if clave:
            validate_password(clave, self.instance)   # mismas reglas de seguridad que el resto del sistema
        return clave

    def save(self, commit=True):
        u = super().save(commit=False)
        u.rol = Usuario.Rol.RECEPCIONISTA
        u.username = u.email                       # el sistema inicia sesión con el correo
        if self.es_nueva:
            u.set_password(self.cleaned_data["clave"])
        if commit:
            u.save()
        return u
