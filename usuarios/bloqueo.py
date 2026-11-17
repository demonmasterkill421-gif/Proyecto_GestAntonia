"""Bloqueo de inicio de sesión: 5 intentos fallidos seguidos bloquean al usuario 15 minutos."""
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.core.cache import cache

MAX_INTENTOS = 5
SEGUNDOS_BLOQUEO = 15 * 60


def _clave(usuario):
    return "intentos_" + str(usuario).strip().lower().replace(" ", "_")


def esta_bloqueado(usuario):
    return cache.get(_clave(usuario), 0) >= MAX_INTENTOS


class BackendConBloqueo(ModelBackend):
    """Igual al login normal de Django, pero cuenta los fallos y bloquea al llegar a 5."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(get_user_model().USERNAME_FIELD)
        if username is None or password is None:
            return None
        if esta_bloqueado(username):
            return None  # bloqueado: no se revisa ni la clave

        usuario = super().authenticate(request, username=username, password=password, **kwargs)
        if usuario is None:
            cache.set(_clave(username), cache.get(_clave(username), 0) + 1, SEGUNDOS_BLOQUEO)
        else:
            cache.delete(_clave(username))
        return usuario
