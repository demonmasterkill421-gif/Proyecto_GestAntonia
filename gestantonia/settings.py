"""
Configuración de GestAntonia - Software de gestión de ventas y asistencia de Estética Antonia.

Los datos sensibles (clave secreta y credenciales de PostgreSQL) se leen desde el archivo .env,
que NO se sube a GitHub. Use .env.example como plantilla.
"""
import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "solo-para-desarrollo-cambiar-en-el-archivo-env")
DEBUG = os.getenv("DJANGO_DEBUG", "True") == "True"
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
    o.strip() for o in os.getenv("DJANGO_CORS_ORIGINS", "").split(",") if o.strip()   # p. ej. el frontend en Vercel
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# Duración de la sesión de la página (token JWT)
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
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
# En Vercel (u otro servidor) la conexión llega en una sola variable: DATABASE_URL.
if os.getenv("DATABASE_URL"):
    _db = urlparse(os.environ["DATABASE_URL"])
    _opciones = {k: v[0] for k, v in parse_qs(_db.query).items() if k in ("sslmode",)}
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": _db.path.lstrip("/"),
            "USER": _db.username,
            "PASSWORD": _db.password,
            "HOST": _db.hostname,
            "PORT": _db.port or 5432,
            "OPTIONS": _opciones or {"sslmode": "require"},
            "CONN_MAX_AGE": 0,
            "DISABLE_SERVER_SIDE_CURSORS": True,   # necesario con el pooler de conexiones de Neon
        }
    }
elif os.getenv("DB_ENGINE", "postgresql") == "sqlite":
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
STATIC_ROOT = BASE_DIR / "staticfiles"        # collectstatic deja aquí los archivos (Vercel lo ejecuta solo)

# ---------------------------------------------------------------------------
# Producción (Vercel): solo se activa con DJANGO_DEBUG=False
# ---------------------------------------------------------------------------
CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")   # Vercel atiende por HTTPS delante de Django
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"