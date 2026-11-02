from django import forms

from catalogo.models import Servicio

from .models import Reserva


class ReservaForm(forms.ModelForm):
    class Meta:
        model = Reserva
        fields = ["clienta", "especialista", "servicio", "inicio"]
        labels = {
            "clienta": "Clienta",
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
        self.fields["inicio"].input_formats = [
            "%Y-%m-%dT%H:%M",
            "%Y-%m-%d %H:%M",
            "%d/%m/%Y %H:%M",
        ]
        self.fields["servicio"].queryset = Servicio.objects.filter(activo=True)