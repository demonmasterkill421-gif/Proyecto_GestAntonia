from rest_framework.exceptions import Throttled #3.10: respuesta 429 cuando la cuenta está bloqueada
from rest_framework.permissions import IsAuthenticated #Valida si es un usuario autenticado, de lo contrario retorna un 401
from rest_framework.response import Response #Devuelve datos desde una vista (diccionario(django) > json(http) > objetos de javascript(react))
from rest_framework.throttling import ScopedRateThrottle #A4: limita cuántas peticiones se aceptan por minuto
from rest_framework.views import APIView #Plantilla para armar vistas
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer #Serializer que se encarga del Login, obtener un par de tókens
from rest_framework_simplejwt.views import TokenObtainPairView #Atiende la petición desde react y se los envía a serializer y desvuelve la respuesta en diccionario

from .bloqueo import esta_bloqueado



def datos_usuario(usuario): #Recibe los datos de un usuario y retorna un diccionario con los datos
    rol = usuario.Rol.ADMINISTRADOR if usuario.es_administrador else usuario.rol #El rol es ADMIN si el usuario.es_administrador de lo contrario, conserva el que tiene.
    return {
        "id": usuario.id,
        "nombre": usuario.first_name,
        "apellido": usuario.last_name,
        "email": usuario.email,
        "rol": rol,
        "local": ( #Si el usuario pertenece a un local, lo agrega, de lo contrario. 
            {"id": usuario.local_id, "nombre": str(usuario.local)}
            if usuario.local_id
            else None
        ),
    }


class LoginSerializer(TokenObtainPairSerializer): #Hereda una plantilla de serializer (validate())
    def validate(self, attrs):
        usuario = attrs.get(self.username_field)
        if esta_bloqueado(usuario):  # 3.10: la cuenta ya tiene 5 fallos seguidos; ni se revisa la clave
            raise Throttled(
                detail="Cuenta bloqueada por 5 intentos fallidos. Intente de nuevo en 15 minutos."
            )
        data = super().validate(attrs)  # clave incorrecta: responde 401 y usuarios/bloqueo.py suma el fallo
        data["usuario"] = datos_usuario(self.user) #arma el diccionario con todos los datos del usuario
        return data


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle] #A4: activa el límite de intentos en esta vista
    throttle_scope = "login" #A4: usa el límite llamado "login" (se define en settings.py)


class MeView(APIView):  
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(datos_usuario(request.user))
