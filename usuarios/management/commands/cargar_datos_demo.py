"""python manage.py cargar_datos_demo · carga locales, personal, catálogo e inventario de prueba.

Las contraseñas de prueba son solo para desarrollo: cámbielas antes de usar el sistema con datos reales.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from catalogo.models import Inventario, Producto, Servicio
from locales.models import Local
from usuarios.models import Usuario

CLAVE_DEMO = "Antonia2026!"


class Command(BaseCommand):
    help = "Carga datos de prueba de Estética Antonia (3 locales, personal, servicios, productos e inventario)."

    @transaction.atomic
    def handle(self, *args, **opts):
        locales = [
            Local.objects.get_or_create(nombre=n, defaults={"ubicacion": u, "descripcion": d})[0]
            for n, u, d in [
                ("Local Mall Plaza Calama", "Mall Plaza Calama", "Local del mall: informa sus ventas al mall."),
                ("Local Centro 1", "Centro de Calama", "Primer local, más de 16 años."),
                ("Local Centro 2", "Centro de Calama", "Abierto desde la pandemia; fuerte en depilación."),
            ]
        ]
        mall, centro1, _ = locales

        def usuario(correo, nombre, apellido, rol, local=None, **extra):
            u, creado = Usuario.objects.get_or_create(
                email=correo,
                defaults=dict(username=correo, first_name=nombre, last_name=apellido, rol=rol, local=local, **extra),
            )
            if creado:
                u.set_password(CLAVE_DEMO)
                u.save()
            return u

        usuario("admin@gestantonia.cl", "Antonia", "Administradora", Usuario.Rol.ADMINISTRADOR,
                is_staff=True, is_superuser=True)
        usuario("paola@gestantonia.cl", "Paola", "Recepción", Usuario.Rol.RECEPCIONISTA, mall)
        usuario("fernanda@gestantonia.cl", "Fernanda", "Rojas", Usuario.Rol.TRABAJADOR, mall,
                cargo=Usuario.Cargo.MANICURISTA, porcentaje_comision=10)
        usuario("liz@gestantonia.cl", "Liz", "Depiladora", Usuario.Rol.TRABAJADOR, centro1,
                cargo=Usuario.Cargo.DEPILADORA, porcentaje_comision=12)

        for nombre, tipo, precio, dur in [
            ("Manicura", Servicio.Tipo.MANICURE, 20000, 60),
            ("Esmaltado permanente", Servicio.Tipo.MANICURE, 17000, 60),
            ("Diseño de uñas N°1", Servicio.Tipo.DISENO_UNAS, 30000, 90),
            ("Depilación de rostro", Servicio.Tipo.DEPILACION, 12000, 20),
            ("Lifting de pestañas", Servicio.Tipo.LIFTING, 25000, 60),
            ("Masaje relajante", Servicio.Tipo.MASAJE, 30000, 60),
        ]:
            Servicio.objects.get_or_create(nombre=nombre, defaults={"tipo": tipo, "precio": precio, "duracion": dur})

        productos = []
        for nombre, tipo, precio, costo in [
            ("Esmalte rojo", Producto.Tipo.INSUMO, 1550, 900),
            ("Algodón", Producto.Tipo.INSUMO, 2500, 1200),
            ("Kit de manicura marca Antonia", Producto.Tipo.VENTA, 8990, 4000),
            ("Perfume en spray", Producto.Tipo.VENTA, 6990, 3000),
        ]:
            productos.append(Producto.objects.get_or_create(
                nombre=nombre, defaults={"tipo": tipo, "precio": precio, "costo": costo})[0])

        for local in locales:
            for p in productos:
                Inventario.objects.get_or_create(producto=p, local=local, defaults={"cantidad": 20, "stock_minimo": 5})

        self.stdout.write(self.style.SUCCESS(
            f"Datos de prueba cargados. Usuarios: admin@, paola@, fernanda@ y liz@gestantonia.cl · clave {CLAVE_DEMO}"))
