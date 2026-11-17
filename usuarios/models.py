"""
Bloque «Usuario» del diagrama de clases.

Usuario (idUser, nombre, apellido, correo, passw, rol) es la clase base; Administrador, Recepcionista
y Trabajador «son un» Usuario. Se implementan como modelos proxy: comparten la tabla usuarios_usuario
y cada uno agrega sus propios métodos. La contraseña nunca se guarda en texto plano: Django la
almacena con hash PBKDF2 (RNF-SA01).
"""
from django.contrib.auth.models import AbstractUser, UserManager
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class UsuarioManager(UserManager):
    """El superusuario creado con createsuperuser queda con rol Administrador."""

    def create_superuser(self, username=None, email=None, password=None, **extra_fields):
        extra_fields.setdefault("rol", Usuario.Rol.ADMINISTRADOR)
        return super().create_superuser(username, email, password, **extra_fields)


class Usuario(AbstractUser):
    class Rol(models.TextChoices):
        ADMINISTRADOR = "ADMIN", "Administrador"
        RECEPCIONISTA = "RECEP", "Recepcionista"
        TRABAJADOR = "TRAB", "Trabajador"

    class Cargo(models.TextChoices):
        MANICURISTA = "MANICURISTA", "Manicurista"
        DEPILADORA = "DEPILADORA", "Depiladora"
        COSMETOLOGA = "COSMETOLOGA", "Cosmetóloga"
        MASOTERAPEUTA = "MASOTERAPEUTA", "Masoterapeuta"
        OTRO = "OTRO", "Otro"

    # nombre y apellido = first_name y last_name heredados de AbstractUser
    email = models.EmailField("correo", unique=True)
    rol = models.CharField(max_length=5, choices=Rol.choices, default=Rol.TRABAJADOR)
    local = models.ForeignKey(
        "locales.Local", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="usuarios", help_text="Local al que está asociado (RF-A03).",
    )
    cargo = models.CharField(max_length=15, choices=Cargo.choices, blank=True)
    porcentaje_comision = models.DecimalField(
        "% de comisión", max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Solo aplica a trabajadoras. Cada una puede tener un sistema de pago distinto.",
    )

    # iniciarSesion(correo, passw): el inicio de sesión se hace con el correo
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username", "first_name", "last_name"]

    objects = UsuarioManager()

    class Meta:
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"
        ordering = ["first_name", "last_name"]

    def __str__(self):
        return f"{self.get_full_name() or self.email} ({self.get_rol_display()})"

    @property
    def es_administrador(self):
        return self.rol == self.Rol.ADMINISTRADOR or self.is_superuser

    @property
    def es_recepcionista(self):
        return self.rol == self.Rol.RECEPCIONISTA

    @property
    def es_trabajador(self):
        return self.rol == self.Rol.TRABAJADOR


# ---------------------------------------------------------------------------
# Especializaciones de Usuario (proxy: misma tabla, filtradas por rol)
# ---------------------------------------------------------------------------
class _RolManager(UsuarioManager):
    use_in_migrations = False
    rol = None

    def get_queryset(self):
        return super().get_queryset().filter(rol=self.rol)


class _AdministradorManager(_RolManager):
    rol = Usuario.Rol.ADMINISTRADOR


class _RecepcionistaManager(_RolManager):
    rol = Usuario.Rol.RECEPCIONISTA


class _TrabajadorManager(_RolManager):
    rol = Usuario.Rol.TRABAJADOR


class _RolFijoMixin:
    """Asegura que cada especialización se guarde siempre con su propio rol."""
    ROL = None

    def save(self, *args, **kwargs):
        self.rol = self.ROL
        super().save(*args, **kwargs)


class Administrador(_RolFijoMixin, Usuario):
    """Gestiona usuarios, locales, inventario, asistencia y reportes."""
    ROL = Usuario.Rol.ADMINISTRADOR
    objects = _AdministradorManager()

    class Meta:
        proxy = True
        verbose_name = "administrador"
        verbose_name_plural = "administradores"

    def crear_usuario(self, correo, password, nombre, apellido, rol, **campos):
        """crearUsuario(): registra un usuario nuevo con su contraseña cifrada."""
        return Usuario.objects.create_user(
            username=correo, email=correo, password=password,
            first_name=nombre, last_name=apellido, rol=rol, **campos,
        )

    def modificar_usuario(self, usuario, **campos):
        """modificarUsuario(): actualiza los campos indicados."""
        password = campos.pop("password", None)
        for campo, valor in campos.items():
            setattr(usuario, campo, valor)
        if password:
            usuario.set_password(password)
        usuario.save()
        return usuario

    def eliminar_usuario(self, usuario):
        """eliminarUsuario(): se desactiva en vez de borrar, para no perder ventas ni asistencias asociadas."""
        usuario.is_active = False
        usuario.save(update_fields=["is_active"])
        return usuario


class Recepcionista(_RolFijoMixin, Usuario):
    """Registra las ventas del local."""
    ROL = Usuario.Rol.RECEPCIONISTA
    objects = _RecepcionistaManager()

    class Meta:
        proxy = True
        verbose_name = "recepcionista"
        verbose_name_plural = "recepcionistas"

    def iniciar_venta(self, local=None):
        """iniciarVenta(): crea un registro de venta en borrador (RF-R01)."""
        from ventas.models import RegistroDeVenta
        return RegistroDeVenta.objects.create(local=local or self.local, recepcionista=self)


class Trabajador(_RolFijoMixin, Usuario):
    """Realiza los servicios y marca su asistencia con código QR."""
    ROL = Usuario.Rol.TRABAJADOR
    objects = _TrabajadorManager()

    class Meta:
        proxy = True
        verbose_name = "trabajador"
        verbose_name_plural = "trabajadores"

    def escanear_codigo_qr(self, token):
        """escanearCodigoQR(): registra la entrada o la salida del día (RF-T01)."""
        from asistencia.models import RegistroDeAsistencia
        return RegistroDeAsistencia.registrar_por_qr(self, token)
