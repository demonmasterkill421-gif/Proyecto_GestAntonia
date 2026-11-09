"""Serializers de la API de Reservas (2.17 · Edson).

Regla del módulo: la lógica de negocio vive en el modelo y en los formularios que ya existen.
Aquí solo se traducen datos JSON ↔ objetos y se llama a esa lógica:
  - Reserva nueva: Reserva.full_clean() → Reserva.clean() (cero topes y especialista del local).
  - Horarios sugeridos ante un tope: disponibilidad.horarios_libres_cercanos().
  - Cliente: normalizar_telefono() de views_clientes (conserva el + inicial) y consentimiento obligatorio.
  - Especialista: EspecialistaForm (clave segura, local obligatorio, no cambiar de local con reservas futuras).
"""
from django.core.exceptions import NON_FIELD_ERRORS
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from catalogo.models import Servicio
from usuarios.models import Usuario

from .disponibilidad import horarios_libres_cercanos
from .forms_especialistas import EspecialistaForm
from .models import Cliente, Reserva
from .views_clientes import normalizar_telefono

_FECHA_HORA = serializers.DateTimeField()


# ------------------------------------------------------------------ utilidades
def errores_del_modelo(error, especialista=None, servicio=None, inicio=None):
    """Pasa un ValidationError de Django al formato de DRF.

    Si el error es un tope de horario (marca el campo «inicio»), agrega los horarios libres
    más cercanos del mismo día, igual que la pantalla de nueva reserva (HU-03, CA-2).
    """
    if hasattr(error, "error_dict"):
        datos = {("detail" if campo == NON_FIELD_ERRORS else campo): mensajes
                 for campo, mensajes in error.message_dict.items()}
    else:
        datos = {"detail": error.messages}
    if "inicio" in datos and especialista and servicio and inicio:
        datos["sugerencias"] = [_FECHA_HORA.to_representation(h)
                                for h in horarios_libres_cercanos(especialista, servicio, inicio)]
    return datos


# ------------------------------------------------------------------ catálogo
class ServicioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servicio
        fields = ["id", "nombre", "precio", "duracion", "tipo"]


# ------------------------------------------------------------------ clientes
class ClienteSerializer(serializers.ModelSerializer):
    # Se acepta el teléfono con espacios o guiones; se guarda limpio (máximo 15 caracteres).
    telefono = serializers.CharField(max_length=30)

    class Meta:
        model = Cliente
        fields = ["id", "nombre", "telefono", "consentimiento"]

    def validate_telefono(self, valor):
        limpio = normalizar_telefono(valor)
        if not limpio or limpio == "+":
            raise serializers.ValidationError("Ingrese un teléfono válido.")
        if len(limpio) > 15:
            raise serializers.ValidationError("El teléfono no puede tener más de 15 caracteres.")
        repetido = Cliente.objects.filter(telefono=limpio)
        if self.instance:
            repetido = repetido.exclude(pk=self.instance.pk)
        if repetido.exists():
            raise serializers.ValidationError("Ese teléfono ya está registrado en el sistema.")
        return limpio

    def validate_consentimiento(self, valor):
        # Leyes 19.628 y 21.719: sin consentimiento no se registran datos personales.
        if not valor:
            raise serializers.ValidationError("Debe aceptar el consentimiento para cumplir la ley de datos.")
        return valor


# ------------------------------------------------------------------ reservas
class ReservaSerializer(serializers.ModelSerializer):
    local_nombre = serializers.CharField(source="local.nombre", read_only=True)
    cliente_nombre = serializers.CharField(source="cliente.nombre", read_only=True)
    cliente_telefono = serializers.CharField(source="cliente.telefono", read_only=True)
    especialista_nombre = serializers.SerializerMethodField()
    servicio_nombre = serializers.CharField(source="servicio.nombre", read_only=True)
    # Al agendar solo se ofrecen especialistas activas y servicios vigentes (igual que ReservaForm).
    especialista = serializers.PrimaryKeyRelatedField(
        queryset=Usuario.objects.filter(rol=Usuario.Rol.TRABAJADOR, is_active=True))
    servicio = serializers.PrimaryKeyRelatedField(queryset=Servicio.objects.filter(activo=True))

    class Meta:
        model = Reserva
        fields = ["id", "local", "local_nombre", "cliente", "cliente_nombre", "cliente_telefono",
                  "especialista", "especialista_nombre", "servicio", "servicio_nombre",
                  "inicio", "fin", "estado", "motivo_cancelacion"]
        read_only_fields = ["fin", "estado", "motivo_cancelacion"]
        extra_kwargs = {"local": {"required": False}}

    def get_especialista_nombre(self, obj):
        return obj.especialista.get_full_name() or obj.especialista.email

    def create(self, validated_data):
        reserva = Reserva(**validated_data)
        try:
            reserva.full_clean()          # ejecuta Reserva.clean(): cero topes y especialista del local
        except DjangoValidationError as e:
            raise serializers.ValidationError(
                errores_del_modelo(e, reserva.especialista, reserva.servicio, reserva.inicio))
        reserva.save()
        return reserva


class ReprogramarSerializer(serializers.Serializer):
    inicio = serializers.DateTimeField()


class CancelarSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=200, allow_blank=True)


# ------------------------------------------------------------------ especialistas
class EspecialistaSerializer(serializers.ModelSerializer):
    """Especialista = Usuario con rol Trabajador. La validación y el guardado los hace EspecialistaForm."""
    nombre = serializers.CharField(source="first_name", required=False)
    apellido = serializers.CharField(source="last_name", required=False)
    local_nombre = serializers.CharField(source="local.nombre", read_only=True, default=None)
    activa = serializers.BooleanField(source="is_active", read_only=True)
    reservas_futuras = serializers.IntegerField(source="futuras", read_only=True, default=None)
    clave = serializers.CharField(write_only=True, required=False, style={"input_type": "password"})

    # Nombres de la API ↔ nombres de EspecialistaForm, para devolver los errores con el nombre correcto.
    _A_FORM = {"nombre": "first_name", "apellido": "last_name", "email": "email", "local": "local",
               "cargo": "cargo", "porcentaje_comision": "porcentaje_comision", "clave": "clave"}

    class Meta:
        model = Usuario
        fields = ["id", "nombre", "apellido", "email", "local", "local_nombre", "cargo",
                  "porcentaje_comision", "activa", "reservas_futuras", "clave"]
        extra_kwargs = {"email": {"validators": []}}   # lo valida el formulario (correo único)

    def validate(self, attrs):
        datos = {}
        if self.instance is not None:      # en PATCH se completan los campos que no vienen
            for campo in ("first_name", "last_name", "email", "cargo", "porcentaje_comision"):
                datos[campo] = getattr(self.instance, campo)
            datos["local"] = self.instance.local_id
        for campo, valor in attrs.items():
            datos[campo] = valor.pk if campo == "local" and valor is not None else valor

        form = EspecialistaForm(data=datos, instance=self.instance)
        if not form.is_valid():
            del_form = {v: k for k, v in self._A_FORM.items()}
            raise serializers.ValidationError(
                {del_form.get(campo, "detail" if campo == NON_FIELD_ERRORS else campo): mensajes
                 for campo, mensajes in form.errors.items()})
        self._form = form
        return attrs

    def create(self, validated_data):
        return self._form.save()

    def update(self, instance, validated_data):
        return self._form.save()
