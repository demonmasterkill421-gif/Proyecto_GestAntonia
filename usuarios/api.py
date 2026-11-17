from rest_framework.exceptions import AuthenticationFailed, Throttled
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .bloqueo import esta_bloqueado


def datos_usuario(usuario):
    rol = usuario.Rol.ADMINISTRADOR if usuario.es_administrador else usuario.rol
    return {
        "id": usuario.id,
        "nombre": usuario.first_name,
        "apellido": usuario.last_name,
        "email": usuario.email,
        "rol": rol,
        "local": (
            {"id": usuario.local_id, "nombre": str(usuario.local)}
            if usuario.local_id
            else None
        ),
    }


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        usuario = attrs.get(self.username_field)
        try:
            if esta_bloqueado(usuario):
                raise AuthenticationFailed()  # ya estaba bloqueado
            data = super().validate(attrs)
        except AuthenticationFailed:
            if esta_bloqueado(usuario):  # bloqueado ahora (incluye el 5to intento)
                raise Throttled(
                    detail="Cuenta bloqueada por 5 intentos fallidos. Intente de nuevo en 15 minutos."
                )
            raise
        data["usuario"] = datos_usuario(self.user)
        return data


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(datos_usuario(request.user))
