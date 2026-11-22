"""
Configuración de GestAntonia - Software de gestión de ventas y asistencia de Estética Antonia.

Los datos sensibles (clave secreta y credenciales de PostgreSQL) se leen desde el archivo .env,
que NO se sube a GitHub. Use .env.example como plantilla.
"""
import os
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DEBUG = os.getenv("DJANGO_DEBUG", "True") == "True"

# En producción la clave secreta DEBE venir del .env: si falta, el sistema no arranca
# (con la clave de desarrollo, que es pública en GitHub, se podrían falsificar sesiones).
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("Falta DJANGO_SECRET_KEY en el archivo .env")
    SECRET_KEY = "solo-para-desarrollo-cambiar-en-el-archivo-env"
ALLOWED_HOSTS = [h.strip() for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Aplicaciones de GestAntonia (una por bloque del diagrama de clases)
    "usuarios.apps.UsuariosConfig",
    "locales.apps.LocalesConfig",
    "catalogo.apps.CatalogoConfig",
    "ventas.apps.VentasConfig",
    "asistencia.apps.AsistenciaConfig",
    "reservas.apps.ReservasConfig",  # Equipo 4: Reservas
    "reportes.apps.ReportesConfig",  # Panel de control (dashboard)
    # API para el frontend en React (Solución 1)
    "rest_framework",
    "corsheaders",
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

CORS_ALLOWED_ORIGINS = ["http://localhost:5173"] + [
    o.strip() for o in os.getenv("DJANGO_CORS_ORIGINS", "").split(",") if o.strip()   # p. ej. el dominio del servidor
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    #login acepta como máximo 5 peticiones por minuto.
    "DEFAULT_THROTTLE_RATES": {"login": "5/min", "clave_anulacion": "20/hour"},
    # A4: hay un proxy delante (Nginx). Con esto el límite usa la IP real que agrega
    # Nginx y no lo que el navegador escriba en la cabecera X-Forwarded-For
    # (si no, bastaba con cambiar esa cabecera para saltarse el límite).
    "NUM_PROXIES": 1,
}

# A4: caché compartida en archivos para que los 3 procesos de Gunicorn del servidor
# lleven una sola cuenta de intentos de login (con la caché en memoria cada proceso
# contaba por separado y el límite real subía a unos 15 por minuto).
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        "LOCATION": BASE_DIR / ".cache_django",
    }
}

# Duración de la sesión de la página (token JWT)
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=8),
}

ROOT_URLCONF = "gestantonia.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "gestantonia.wsgi.application"

# ---------------------------------------------------------------------------
# Base de datos: PostgreSQL (valores en .env)
# DB_ENGINE=sqlite solo para pruebas rápidas sin PostgreSQL instalado.
# ---------------------------------------------------------------------------
if os.getenv("DB_ENGINE", "postgresql") == "sqlite":
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("DB_NAME", "gestantonia"),
            "USER": os.getenv("DB_USER", "gestantonia"),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST": os.getenv("DB_HOST", "localhost"),
            "PORT": os.getenv("DB_PORT", "5432"),
        }
    }

# ---------------------------------------------------------------------------
# Usuarios y seguridad (RNF-SA01 y RNF-SA02)
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "usuarios.Usuario"          # debe existir ANTES del primer migrate

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LOGIN_URL = "usuarios:login"
LOGIN_REDIRECT_URL = "usuarios:inicio"
LOGOUT_REDIRECT_URL = "usuarios:login"

# Cierre de sesión automático por inactividad (EA_002): 30 minutos sin actividad.
SESSION_COOKIE_AGE = 30 * 60
SESSION_SAVE_EVERY_REQUEST = True
SESSION_EXPIRE_AT_BROWSER_CLOSE = True

# ---------------------------------------------------------------------------
# Internacionalización
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "es-cl"
TIME_ZONE = "America/Santiago"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"        # collectstatic deja aquí los archivos (Nginx los sirve)

# ---------------------------------------------------------------------------
# Producción (servidor con Nginx): solo se activa con DJANGO_DEBUG=False
# ---------------------------------------------------------------------------
# Dirección pública de React: se usa para armar enlaces que se abren fuera del sistema (QR de asistencia).
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")   # Nginx atiende por HTTPS delante de Django
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    # HSTS: el navegador usará siempre HTTPS con este sitio. Se parte con 1 hora;
    # cuando el dominio sea definitivo se puede subir a 31536000 (1 año).
    SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_HSTS_SECONDS", "3600"))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"