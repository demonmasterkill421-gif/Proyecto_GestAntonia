"""Primera administradora (entrega oficial): cuando la base no tiene NINGÚN usuario, la página de
inicio ofrece crear la cuenta de la administradora. Apenas existe un usuario, esto se cierra solo.

GET  /api/instalacion/   {"pendiente": bool, "pide_codigo": bool}
POST /api/instalacion/   {"nombre", "apellido", "email", "clave", "repetir_clave", "codigo"}

Seguridad: en un servidor recién instalado cualquiera podría llegar primero a esta página. Por eso se
pide el CÓDIGO DE INSTALACIÓN que está en el .env del servidor (CODIGO_INSTALACION, lo genera
deploy_gestantonia.sh y lo muestra al terminar). Sin código configurado, solo funciona con DEBUG=True
(computador de desarrollo).
"""
import hmac
import os

from django.conf import settings
from django.db import connection, transaction
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .gestion import validar_clave
from .models import Usuario


def codigo_configurado():
    return os.getenv("CODIGO_INSTALACION", "").strip()


def instalacion_pendiente():
    return not Usuario.objects.exists()


class PrimeraAdministradoraSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=150)
    apellido = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField()
    clave = serializers.CharField(trim_whitespace=False)
    repetir_clave = serializers.CharField(trim_whitespace=False)
    codigo = serializers.CharField(required=False, allow_blank=True, trim_whitespace=True)

    def validate(self, datos):
        if datos["clave"] != datos["repetir_clave"]:
            raise serializers.ValidationError({"repetir_clave": "Las contraseñas no coinciden."})
        prueba = Usuario(email=datos["email"], first_name=datos["nombre"], last_name=datos.get("apellido", ""))
        validar_clave(datos["clave"], prueba)
        datos["email"] = datos["email"].strip().lower()
        return datos


class InstalacionView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []  # no necesita sesión: aún no existe ningún usuario
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "instalacion"  # 5 intentos por minuto (settings.py): adivinar el código no sirve

    def get_throttles(self):
        # Solo se limita el envío del formulario; consultar si falta la instalación es libre
        return super().get_throttles() if self.request.method == "POST" else []

    def get(self, request):
        return Response({"pendiente": instalacion_pendiente(), "pide_codigo": bool(codigo_configurado())})

    def post(self, request):
        codigo = codigo_configurado()
        if not codigo and not settings.DEBUG:
            return Response({"detail": "Falta CODIGO_INSTALACION en el .env del servidor. "
                                       "Vuelve a ejecutar el despliegue para generarlo."},
                            status=status.HTTP_403_FORBIDDEN)
        datos = PrimeraAdministradoraSerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        datos = datos.validated_data
        if codigo and not hmac.compare_digest(datos.get("codigo", "").encode(), codigo.encode()):
            return Response({"codigo": ["El código de instalación no es correcto."]},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Bloquea la tabla para que dos personas no creen la "primera" cuenta al mismo tiempo
            if connection.vendor == "postgresql":
                with connection.cursor() as cursor:
                    cursor.execute(f"LOCK TABLE {Usuario._meta.db_table} IN EXCLUSIVE MODE")
            if not instalacion_pendiente():
                return Response({"detail": "El sistema ya tiene usuarios: inicia sesión."},
                                status=status.HTTP_403_FORBIDDEN)
            Usuario.objects.create_user(
                username=datos["email"], email=datos["email"], password=datos["clave"],
                first_name=datos["nombre"].strip(), last_name=datos.get("apellido", "").strip(),
                rol=Usuario.Rol.ADMINISTRADOR, is_staff=True, is_superuser=True,
            )
        return Response({"detail": "Cuenta de administradora creada. Ya puedes iniciar sesión."},
                        status=status.HTTP_201_CREATED)
