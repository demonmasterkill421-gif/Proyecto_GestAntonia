from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


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
        data = super().validate(attrs)
        data["usuario"] = datos_usuario(self.user)
        return data


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(datos_usuario(request.user))