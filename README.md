GestAntonia

1. Configuración de PostgreSQL

- Puerto: 5432 (el que propone el instalador).
- Base de datos: gestantonia
- Usuario: gestantonia (con permiso CREATEDB, necesario para correr las pruebas).

Crear el usuario y la base, entrando con el superusuario postgres:

    psql -U postgres

Luego, dentro de psql:

    CREATE USER gestantonia WITH PASSWORD 'una-clave-segura' CREATEDB;
    CREATE DATABASE gestantonia OWNER gestantonia ENCODING 'UTF8';
    \q

Si psql no se reconoce, agreguen C:\Program Files\PostgreSQL\18\bin a la variable Path y reabra la consola.

El proyecto lee la conexión desde el archivo .env (que no se sube a GitHub). Para crearlo:

    copy .env.example .env

Y completen estos valores:

    DB_NAME=gestantonia
    DB_USER=gestantonia
    DB_PASSWORD=La clave creada en en CREATE USER
    DB_HOST=localhost
    DB_PORT=5432
    DJANGO_SECRET_KEY=una clave aleatoria (que se genera con: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")


2. Configuración de DBeaver

- Nueva conexión: Database > New Database Connection > PostgreSQL.
- Host: localhost / Port: 5432 / Database: gestantonia
- Usuario: gestantonia / Password: la misma del .env (marque Save password).
- Test Connection. La primera vez acepte descargar el driver.

Para ver el diagrama: Databases > gestantonia > Schemas > public > Tables, seleccione las tablas
del proyecto con Ctrl + clic y use clic derecho > View Diagram.

Para exportarlo: clic derecho sobre el fondo del diagrama > Save diagram as... y guárdelo en
docs\diagrama_bd_dbeaver.png. En docs\diagrama_bd_referencia.png hay uno de referencia para comparar.


3. Migraciones

Instalar dependencias y crear las tablas (con el entorno virtual activo):

    pip install -r requirements.txt
    python manage.py migrate
    python manage.py cargar_datos_demo
    python manage.py test
    python manage.py runserver

- Las migraciones ya vienen en cada app (carpetas migrations). No hay que generarlas de nuevo.
- Use python manage.py makemigrations solo cuando cambie un models.py, y suba la migración nueva junto
  con ese cambio. Conviene que una sola persona a la vez modifique los modelos.
- settings.py define AUTH_USER_MODEL = "usuarios.Usuario". Debe estar antes del primer migrate; si alguien
  migró sin él, hay que borrar la base, crearla de nuevo y volver a ejecutar migrate.
- python manage.py test debe terminar con: Ran 20 tests ... OK


4. Detalles del programa

Aplicaciones y tablas (una app por bloque del diagrama de clases):

- usuarios: tabla usuarios_usuario. Administrador, Recepcionista y Trabajador son modelos proxy de
  Usuario (comparten la tabla y se distinguen por el campo rol). Se inicia sesión con el correo.
- locales: tabla locales_local.
- catalogo: tablas catalogo_item, catalogo_servicio, catalogo_producto y catalogo_inventario
  (stock de cada producto por local). Servicio y Producto heredan de Item.
- ventas: tablas ventas_registrodeventa y ventas_detalleventa (ítems de cada venta).
- asistencia: tablas asistencia_registrodeasistencia y asistencia_codigoqr.

Tablas que no estaban en el diagrama de clases: ventas_detalleventa, catalogo_inventario y
asistencia_codigoqr.

Funcionamiento:

- http://127.0.0.1:8000/ abre el inicio de sesión y redirige al panel de cada rol.
- http://127.0.0.1:8000/admin/ es el CRUD de locales, usuarios, catálogo, inventario, ventas y asistencia
  (solo administradora).
- La sesión se cierra sola tras 30 minutos sin actividad.
- Las contraseñas se guardan cifradas (hash PBKDF2).
- Al confirmar una venta se descuenta el stock del local y se asigna un folio de boleta correlativo
  por local. Una venta anulada devuelve el stock.
- La comisión de cada trabajadora se calcula sobre el monto total con su porcentaje de comisión.
- La asistencia se marca escaneando el QR del local: el primer escaneo del día es la entrada y el
  segundo la salida. La administradora puede corregir un marcaje indicando el motivo.

Usuarios de prueba (creados por cargar_datos_demo, clave Antonia2026! para todos; solo para desarrollo):

- admin@gestantonia.cl - Administradora
- paola@gestantonia.cl - Recepcionista, Local Mall Plaza Calama
- fernanda@gestantonia.cl - Trabajadora, manicurista
- liz@gestantonia.cl - Trabajadora, depiladora
