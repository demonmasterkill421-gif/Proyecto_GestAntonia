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
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from catalogo.models import Servicio
from locales.models import Local
from usuarios.models import Usuario

from .disponibilidad import horarios_libres_cercanos
from .forms_especialistas import EspecialistaForm
from .models import Cliente, EspecialistaServicio, Reserva
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


# ------------------------------------------------------------------ locales
class LocalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Local
        fields = ["id", "nombre", "ubicacion", "estado"]


# ------------------------------------------------------------------ clientes
class ClienteSerializer(serializers.ModelSerializer):
    # Se acepta el teléfono con espacios o guiones; se guarda limpio (máximo 15 caracteres).
    telefono = serializers.CharField(max_length=30)
    observacion_por_nombre = serializers.SerializerMethodField()

    def get_observacion_por_nombre(self, obj):
        u = obj.observacion_por
        return (u.get_full_name() or u.email) if u else None

    class Meta:
        model = Cliente
        fields = ["id", "nombre", "telefono", "consentimiento",
                  "observacion", "observacion_actualizada", "observacion_por_nombre"]
        read_only_fields = ["observacion", "observacion_actualizada"]

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
    cliente_observacion = serializers.CharField(source="cliente.observacion", read_only=True)
    especialista_nombre = serializers.SerializerMethodField()
    servicio_nombre = serializers.CharField(source="servicio.nombre", read_only=True)
    estado_nombre = serializers.CharField(source="get_estado_display", read_only=True)
    ocupa_horario = serializers.BooleanField(read_only=True)
    # Al agendar solo se ofrecen especialistas activas y servicios vigentes (igual que ReservaForm).
    especialista = serializers.PrimaryKeyRelatedField(
        queryset=Usuario.objects.filter(rol=Usuario.Rol.TRABAJADOR, is_active=True))
    servicio = serializers.PrimaryKeyRelatedField(queryset=Servicio.objects.filter(activo=True))

    class Meta:
        model = Reserva
        fields = ["id", "local", "local_nombre", "cliente", "cliente_nombre", "cliente_telefono", "cliente_observacion",
                  "especialista", "especialista_nombre", "servicio", "servicio_nombre",
                  "inicio", "fin", "estado", "estado_nombre", "ocupa_horario", "motivo_cancelacion"]
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


class ObservacionSerializer(serializers.Serializer):
    observacion = serializers.CharField(max_length=500, allow_blank=True)


class EstadoSerializer(serializers.Serializer):
    estado = serializers.ChoiceField(choices=Reserva.Estado.choices)
    motivo = serializers.CharField(max_length=200, allow_blank=True, required=False, default="")


# ------------------------------------------------------------------ especialistas
class ServicioAsignadoSerializer(serializers.ModelSerializer):
    """Un servicio que realiza la especialista y su % de comisión en ese servicio."""
    servicio = serializers.PrimaryKeyRelatedField(queryset=Servicio.objects.filter(activo=True))
    servicio_nombre = serializers.CharField(source="servicio.nombre", read_only=True)

    class Meta:
        model = EspecialistaServicio
        fields = ["servicio", "servicio_nombre", "porcentaje_comision"]


class EspecialistaSerializer(serializers.ModelSerializer):
    """Especialista = Usuario con rol Trabajador. La validación y el guardado los hace EspecialistaForm."""
    nombre = serializers.CharField(source="first_name", required=False)
    apellido = serializers.CharField(source="last_name", required=False)
    local_nombre = serializers.CharField(source="local.nombre", read_only=True, default=None)
    activa = serializers.BooleanField(source="is_active", read_only=True)
    reservas_futuras = serializers.IntegerField(source="futuras", read_only=True, default=None)
    clave = serializers.CharField(write_only=True, required=False, style={"input_type": "password"})
    # Servicios que realiza y su comisión en cada uno: [{"servicio": 3, "porcentaje_comision": "12"}, ...]
    servicios = ServicioAsignadoSerializer(source="servicios_asignados", many=True, required=False)

    # Nombres de la API ↔ nombres de EspecialistaForm, para devolver los errores con el nombre correcto.
    _A_FORM = {"nombre": "first_name", "apellido": "last_name", "email": "email", "local": "local",
               "cargo": "cargo", "porcentaje_comision": "porcentaje_comision", "clave": "clave"}

    class Meta:
        model = Usuario
        fields = ["id", "nombre", "apellido", "email", "local", "local_nombre", "cargo",
                  "porcentaje_comision", "servicios", "activa", "reservas_futuras", "clave"]
        extra_kwargs = {"email": {"validators": []}}   # lo valida el formulario (correo único)

    def validate(self, attrs):
        servicios = attrs.pop("servicios_asignados", None)
        errores_servicios = self._revisar_servicios(servicios)
        datos = {}
        if self.instance is not None:      # en PATCH se completan los campos que no vienen
            for campo in ("first_name", "last_name", "email", "cargo", "porcentaje_comision"):
                datos[campo] = getattr(self.instance, campo)
            datos["local"] = self.instance.local_id
        for campo, valor in attrs.items():
            datos[campo] = valor.pk if campo == "local" and valor is not None else valor

        form = EspecialistaForm(data=datos, instance=self.instance)
        errores = {}
        if not form.is_valid():
            del_form = {v: k for k, v in self._A_FORM.items()}
            errores = {del_form.get(campo, "detail" if campo == NON_FIELD_ERRORS else campo): mensajes
                       for campo, mensajes in form.errors.items()}
        if errores_servicios:
            errores["servicios"] = errores_servicios
        if errores:
            raise serializers.ValidationError(errores)
        self._form = form
        self._servicios = servicios
        return attrs

    def _revisar_servicios(self, servicios):
        """Al crear: al menos un servicio. Al editar: no repetir ni quitar uno con reservas futuras."""
        if servicios is None:
            return ["Asigna al menos un servicio que realice la especialista."] if self.instance is None else []
        if not servicios:
            return ["La especialista debe realizar al menos un servicio."]
        ids = [s["servicio"].pk for s in servicios]
        if len(ids) != len(set(ids)):
            return ["Un servicio aparece repetido."]
        if self.instance is not None:
            quitados = set(self.instance.servicios_asignados.values_list("servicio_id", flat=True)) - set(ids)
            ocupados = (Reserva.objects.filter(especialista=self.instance, servicio_id__in=quitados,
                                               inicio__gte=timezone.now())
                        .exclude(estado__in=Reserva.LIBERAN_HORARIO)
                        .values_list("servicio__nombre", flat=True).distinct())
            if ocupados:
                return [f"No se puede quitar {', '.join(sorted(ocupados))}: tiene reservas futuras de ese servicio. "
                        "Reprográmalas o suspéndelas primero."]
        return []

    def _guardar_servicios(self, especialista):
        if self._servicios is None:
            return
        nuevos = {s["servicio"].pk: s["porcentaje_comision"] for s in self._servicios}
        especialista.servicios_asignados.exclude(servicio_id__in=nuevos).delete()
        for servicio_id, porcentaje in nuevos.items():
            EspecialistaServicio.objects.update_or_create(
                especialista=especialista, servicio_id=servicio_id, defaults={"porcentaje_comision": porcentaje})

    @transaction.atomic
    def create(self, validated_data):
        especialista = self._form.save()
        self._guardar_servicios(especialista)
        return especialista

    @transaction.atomic
    def update(self, instance, validated_data):
        especialista = self._form.save()
        self._guardar_servicios(especialista)
        return especialista

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if request and not request.user.es_administrador:   # la recepcionista ve qué servicios hace, no cuánto gana
            for servicio in data["servicios"]:
                servicio.pop("porcentaje_comision", None)
        return data
