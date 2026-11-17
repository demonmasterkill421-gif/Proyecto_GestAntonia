from django import forms

from catalogo.models import Servicio

from .models import Reserva

FORMATOS_FECHA_HORA = [
    "%Y-%m-%dT%H:%M",  # <input type="datetime-local">
    "%Y-%m-%d %H:%M",
    "%d/%m/%Y %H:%M",  # formato del informe: dd/mm/aaaa y 24 horas
]


def _campo_fecha_hora(etiqueta):
    return forms.DateTimeField(
        label=etiqueta,
        input_formats=FORMATOS_FECHA_HORA,
        widget=forms.DateTimeInput(attrs={"type": "datetime-local"}, format="%Y-%m-%dT%H:%M"),
    )


class ReservaForm(forms.ModelForm):
    """Formulario de nueva reserva.

    El local NO es un campo: la vista lo asigna con request.user.local.
    El fin y el estado los resuelve el modelo (duración del servicio y estado «Agendada»).
    """

    class Meta:
        model = Reserva
        fields = ["cliente", "especialista", "servicio", "inicio"]
        labels = {
            "cliente": "Cliente",
            "especialista": "Especialista",
            "servicio": "Servicio",
            "inicio": "Fecha y hora de inicio",
        }
        widgets = {
            "inicio": forms.DateTimeInput(
                attrs={"type": "datetime-local"}, format="%Y-%m-%dT%H:%M"
            ),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["inicio"].input_formats = FORMATOS_FECHA_HORA
        # Solo se ofrecen los servicios vigentes del catálogo.
        self.fields["servicio"].queryset = Servicio.objects.filter(activo=True)


class ReprogramarForm(forms.Form):
    """Nueva hora de una reserva existente (tarea 2.1). Los topes los valida Reserva.reprogramar()."""

    inicio = _campo_fecha_hora("Nueva fecha y hora de inicio")


class CancelarForm(forms.Form):
    """Motivo de cancelación (tarea 2.2). El largo máximo es el del campo del modelo (200)."""

    motivo = forms.CharField(
        label="Motivo de la cancelación",
        max_length=200,
        error_messages={"required": "Indique el motivo de la cancelación."},
    )