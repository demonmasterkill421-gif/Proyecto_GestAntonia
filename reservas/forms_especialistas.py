"""
2.4Formulario de especialistas.

Una especialista es un Usuario con rol Trabajador. No se crea una tabla nueva: se usa el modelo
Usuario del repositorio común, con su local, su cargo y su porcentaje de comisión.
"""
from django import forms
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone

from usuarios.models import Usuario

from .models import Reserva


class EspecialistaForm(forms.ModelForm):
    clave = forms.CharField(
        label="Clave inicial", widget=forms.PasswordInput, required=False,
        help_text="Con esta clave la especialista entra al sistema (por ejemplo, para marcar su asistencia).",
    )

    class Meta:
        model = Usuario
        fields = ["first_name", "last_name", "email", "local", "cargo", "porcentaje_comision"]
        labels = {"first_name": "Nombre", "last_name": "Apellido", "email": "Correo",
                  "local": "Local", "cargo": "Cargo", "porcentaje_comision": "% de comisión"}
        help_texts = {"local": "Local donde atiende. Solo aparecerá al agendar en ese local.",
                      "porcentaje_comision": "Comisión base sobre sus servicios, de 0 a 100 (regla por confirmar en la tarea 2.6)."}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.es_nueva = self.instance.pk is None
        for campo in ("first_name", "last_name", "local", "cargo"):
            self.fields[campo].required = True     # en el modelo son opcionales; para una especialista no
        if self.es_nueva:
            self.fields["clave"].required = True
        else:
            del self.fields["clave"]               # al editar no se pide clave; se cambia desde /admin/

    def clean_clave(self):
        clave = self.cleaned_data.get("clave")
        if clave:
            validate_password(clave, self.instance)   # mismas reglas de seguridad que el resto del sistema
        return clave

    def clean_local(self):
        """No se cambia de local a una especialista que tiene reservas futuras en su local actual."""
        nuevo = self.cleaned_data.get("local")
        if not self.es_nueva and self.instance.local_id and nuevo and nuevo.pk != self.instance.local_id:
            futuras = reservas_futuras(self.instance).count()
            if futuras:
                raise forms.ValidationError(
                    f"Tiene {futuras} reserva(s) futura(s) en {self.instance.local}. "
                    "Reprográmelas o cancélelas antes de cambiarla de local.")
        return nuevo

    def save(self, commit=True):
        u = super().save(commit=False)
        u.rol = Usuario.Rol.TRABAJADOR
        u.username = u.email                       # el sistema inicia sesión con el correo
        if self.es_nueva:
            u.set_password(self.cleaned_data["clave"])
        if commit:
            u.save()
        return u


def reservas_futuras(especialista):
    """Reservas activas (no canceladas) de la especialista desde ahora en adelante."""
    return (Reserva.objects.filter(especialista=especialista, inicio__gte=timezone.now())
            .exclude(estado=Reserva.Estado.CANCELADA))