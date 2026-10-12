# GestAntonia

Software de gestión de ventas, servicios y asistencia para **Estética Antonia** (Calama).
Proyecto Integrado INACAP · Grupo 5 de la Solución 1: Maximiliano Pereira, Cristóbal Ulloa e Ignacio Miles.

Stack: **Python + Django 5.2 (LTS) + PostgreSQL**. Los comandos de esta guía son para **Windows con Cmder**
(consola `cmd`, el prompt que muestra `λ`).

---

## 1. Qué hay en este repositorio

El diagrama de clases del informe está implementado como modelos de Django (capa *Modelo* del MVC),
repartido en una aplicación por bloque del diagrama:

| Clase del diagrama | Implementación en Django | Tabla en PostgreSQL |
|---|---|---|
| Usuario | `usuarios.Usuario` (extiende el usuario de Django; inicia sesión con el correo) | `usuarios_usuario` |
| Administrador · Recepcionista · Trabajador («es un» Usuario) | Modelos *proxy* `Administrador`, `Recepcionista`, `Trabajador`, filtrados por `rol` | `usuarios_usuario` (misma tabla) |
| Local | `locales.Local` | `locales_local` |
| Item | `catalogo.Item` | `catalogo_item` |
| Servicio · Producto («es un» Item) | Herencia multitabla `catalogo.Servicio` y `catalogo.Producto` | `catalogo_servicio`, `catalogo_producto` |
| RegistroDeVenta | `ventas.RegistroDeVenta` | `ventas_registrodeventa` |
| RegistroDeAsistencia | `asistencia.RegistroDeAsistencia` | `asistencia_registrodeasistencia` |

Los métodos del diagrama existen con el mismo nombre en `snake_case`. Por ejemplo, `iniciarVenta()` se
llama `Recepcionista.iniciar_venta()`, `confirmarVenta()` se llama `RegistroDeVenta.confirmar_venta()` y
`escanearCodigoQR()` se llama `Trabajador.escanear_codigo_qr()`.

**Tablas que se agregaron al diagrama** (conviene incorporarlas al diagrama de clases del informe):

| Tabla | Por qué |
|---|---|
| `ventas.DetalleVenta` | Implementa la relación «Contiene» entre venta e ítem, con cantidad y precio del momento (`items[]`). |
| `catalogo.Inventario` | Stock de cada producto **por local**, con stock mínimo para la alerta (RF-A04, RF-R03). |
| `asistencia.CodigoQR` | Código que genera la administradora para cada local, con vigencia (RF-A07). |
| Campos nuevos | `metodo_pago`, `estado` y `folio` en la venta; `tipo` (venta o insumo) en el producto, para diferenciar el producto que se vende del que se consume; `porcentaje_comision`, `cargo` y `local` en el usuario; `estado` y datos de corrección en la asistencia (RF-A10). |

También incluye el **inicio y cierre de sesión por rol** (EA_001 y EA_002), con cierre automático tras 30 minutos
de inactividad; **acceso restringido por rol** (RNF-SA02: cada panel rechaza con error 403 a los otros roles,
mediante el decorador `usuarios/permisos.py`); el panel de administración de Django como CRUD inicial y
**20 pruebas automáticas**.

```
gestantonia/            configuración (settings.py lee la base de datos desde .env)
usuarios/  locales/  catalogo/  ventas/  asistencia/   una app por bloque del diagrama
templates/  static/     pantallas de login y paneles con la guía de estilos UX/UI
docs/                   diagramas de la base de datos
```

---

## 2. Instalar los programas (una sola vez por computador)

### 2.0 Cmder
1. Descargue **Cmder Full** (incluye Git para Windows) desde <https://cmder.app/>.
2. Descomprima el .zip en `C:\cmder` y abra `Cmder.exe`. Si Windows pregunta, permita el acceso.
3. Deje la consola en modo **cmd** (pestaña por defecto, prompt `λ`): todos los comandos de esta guía son para ese modo.

### 2.1 Python
1. Descargue **Python 3.12 o 3.13** desde <https://www.python.org/downloads/windows/>.
2. En el instalador marque **«Add python.exe to PATH»** y luego *Install Now*.
3. Compruebe en Cmder: `python --version`

### 2.2 Git
Si instaló **Cmder Full**, Git ya viene incluido. Compruebe con `git --version`.
Si no aparece, instale Git desde <https://git-scm.com/download/win>.

### 2.3 PostgreSQL
1. Descargue el instalador para Windows desde <https://www.postgresql.org/download/windows/>
   (enlace *Download the installer*, de EDB). Elija la versión **18** (la estable más reciente).
2. En el asistente:
   - Componentes: deje **PostgreSQL Server**, **pgAdmin 4** y **Command Line Tools**. *Stack Builder* no es necesario.
   - Escriba una contraseña para el superusuario **postgres** y **anótela**.
   - Puerto: **5432**. Configuración regional: *Default locale*.
3. Agregue los comandos de PostgreSQL al PATH para usar `psql` en Cmder:
   - Abra *Editar las variables de entorno del sistema* → *Variables de entorno*.
   - En *Path* (de su usuario) agregue `C:\Program Files\PostgreSQL\18\bin` (cambie 18 si instaló otra versión).
   - Cierre y vuelva a abrir Cmder. Compruebe con `psql --version`.

### 2.4 Crear la base de datos y el usuario del proyecto
En Cmder:

```
psql -U postgres
```

Escriba la contraseña de *postgres* y luego, dentro de `psql` (cambie la clave):

```sql
CREATE USER gestantonia WITH PASSWORD 'una-clave-segura' CREATEDB;
CREATE DATABASE gestantonia OWNER gestantonia ENCODING 'UTF8';
\q
```

`CREATEDB` es necesario para que `python manage.py test` pueda crear su base de pruebas.
Si `psql` muestra un aviso sobre la *página de códigos* de la consola, no afecta en nada.

### 2.5 DBeaver
1. Descargue **DBeaver Community** desde <https://dbeaver.io/download/> (*Windows installer*).
2. Instálelo con las opciones por defecto.

---

## 3. Crear el proyecto Django (comandos en Cmder)

> Este repositorio **ya contiene** el resultado de estos pasos. Úselos como referencia de cómo se creó, o
> sáltese al punto 4 si solo va a clonar el repositorio.

```
cd %USERPROFILE%\Documents
mkdir gestantonia
cd gestantonia

python -m venv venv
venv\Scripts\activate
python -m pip install --upgrade pip
pip install "Django==5.2.18" "psycopg[binary]==3.3.6" "python-dotenv==1.2.4"

django-admin startproject gestantonia .
python manage.py startapp usuarios
python manage.py startapp locales
python manage.py startapp catalogo
python manage.py startapp ventas
python manage.py startapp asistencia
```

Luego se reemplazaron los archivos generados por los de este repositorio: `gestantonia/settings.py`,
`gestantonia/urls.py`, los `models.py`, `admin.py` y `apps.py` de cada app, y las carpetas `templates/` y `static/`.

> **Importante:** `AUTH_USER_MODEL = "usuarios.Usuario"` debe estar en `settings.py` **antes del primer
> `migrate`**. Si alguien ya migró sin él, debe borrar y volver a crear la base de datos.

*(Si usa Cmder en modo bash en vez de cmd, active el entorno con `source venv/Scripts/activate`.)*

---

## 4. Poner a andar el proyecto

**Primera vez (quien sube el proyecto al repositorio):** clone el repositorio del grupo, cree una rama y
copie dentro de la carpeta clonada **todo el contenido** del .zip `GestAntonia_Django` (incluidos `.gitignore`
y `.env.example`, que son archivos ocultos):

```
cd %USERPROFILE%\Documents
git clone https://github.com/USUARIO/REPOSITORIO.git gestantonia
cd gestantonia
git checkout -b feature/modelos-django
explorer .
```

**Resto del equipo (cuando el proyecto ya está en GitHub):** solo `git clone` y `cd gestantonia`.

Luego, en ambos casos:

```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
notepad .env
```

En `.env` escriba la clave del usuario `gestantonia` (`DB_PASSWORD`) y una `DJANGO_SECRET_KEY` larga.
Para generar una clave secreta:

```
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Luego cree las tablas, cargue datos de prueba y verifique que todo funciona:

```
python manage.py migrate
python manage.py cargar_datos_demo
python manage.py test
python manage.py runserver
```

Abra <http://127.0.0.1:8000/> e ingrese con un usuario de prueba (clave `Antonia2026!`):

| Correo | Rol |
|---|---|
| admin@gestantonia.cl | Administradora (también entra a <http://127.0.0.1:8000/admin/>) |
| paola@gestantonia.cl | Recepcionista (Local Mall Plaza Calama) |
| fernanda@gestantonia.cl | Trabajadora, manicurista |
| liz@gestantonia.cl | Trabajadora, depiladora |

Para crear su propio administrador: `python manage.py createsuperuser`.

**Migraciones:** las migraciones ya vienen en el repositorio. Ejecute `python manage.py makemigrations`
**solo cuando cambie un `models.py`**, y suba la migración nueva junto con el cambio. Para evitar conflictos,
acuerden que una sola persona a la vez modifique los modelos.

---

## 5. Generar el diagrama de la base de datos en DBeaver

### 5.1 Conectarse a PostgreSQL
1. Abra DBeaver → menú **Database → New Database Connection** (o el ícono del enchufe con un «+»).
2. Elija **PostgreSQL** → *Next*.
3. Complete:
   - Host: `localhost` · Port: `5432`
   - Database: `gestantonia`
   - Username: `gestantonia` · Password: la clave del punto 2.4 (marque *Save password*)
4. Pulse **Test Connection**. La primera vez DBeaver ofrece **descargar el driver**: acepte (*Download*).
5. Debe aparecer *Connected*. Pulse *Finish*.

### 5.2 Ver el diagrama
1. En el panel *Database Navigator* abra:
   `gestantonia → Databases → gestantonia → Schemas → public → Tables`.
2. Para ver **solo las tablas del proyecto** (sin las tablas internas de Django `auth_*`, `django_*`):
   - Seleccione con **Ctrl + clic** las tablas que empiezan con `usuarios_`, `locales_`, `catalogo_`,
     `ventas_` y `asistencia_`.
   - Clic derecho → **View Diagram**.
3. Para el diagrama de **todo el esquema**: doble clic sobre **public** (o sobre **Tables**) y abra la pestaña **ER Diagram**.
4. Ordene las tablas con el botón **Layout** (*Arrange*) de la barra del diagrama.
   Las líneas son las llaves foráneas y el extremo con «patas» indica el lado «muchos».

> Las tablas `usuarios_usuario_groups` y `usuarios_usuario_user_permissions` son del sistema de permisos de
> Django; puede dejarlas fuera del diagrama.

### 5.3 Exportar la imagen al repositorio
1. Clic derecho sobre el fondo del diagrama → **Save diagram as…** (o el botón *Save diagram in external format* de la barra del diagrama).
2. Elija **PNG** (o SVG) y guárdelo como `docs\diagrama_bd_dbeaver.png` dentro del proyecto.

En `docs/diagrama_bd_referencia.png` hay un diagrama de referencia generado desde la misma base,
para comparar con el que muestre DBeaver.

---

## 6. Guardar el proyecto en GitHub

### 6.1 Configuración inicial (una vez por computador)

```
git config --global user.name "Su Nombre"
git config --global user.email "su-correo@ejemplo.com"
```

### 6.2 Primera subida al repositorio del grupo
Desde la carpeta clonada del punto 4, ya en la rama `feature/modelos-django`:

```
git status
git add .
git commit -m "Sprint 1: modelos del diagrama de clases en Django, login por rol y diagrama de BD"
git push -u origin feature/modelos-django
```

Revise que `git status` **no** muestre `venv/` ni `.env`: el archivo `.gitignore` los excluye.
La primera vez que haga `push`, Git para Windows abre el navegador para iniciar sesión en GitHub.

> **Si el repositorio de GitHub está vacío** (sin ningún commit), no hay rama `main` contra la cual abrir el
> pull request. En ese caso suba este primer commit directo a `main`:
> `git branch -M main` y luego `git push -u origin main`. Desde ahí, todo lo demás va por ramas.
>
> **Si todavía no existe el repositorio:** en GitHub pulse **New repository**, póngale `gestantonia`, déjelo
> **sin** README ni .gitignore, y agregue a sus compañeros en *Settings → Collaborators*.

### 6.3 Pull request
1. En GitHub aparecerá el aviso **Compare & pull request** de la rama `feature/modelos-django`.
2. Cree el pull request hacia `main`. Otro integrante lo revisa y lo aprueba (*Definition of Done*).
3. Pulse **Merge pull request**.

### 6.4 Trabajo diario

```
git checkout main
git pull
git checkout -b feature/nombre-de-la-tarea
(programar)
python manage.py test
git add .
git commit -m "EA_00X: descripción breve del cambio"
git push -u origin feature/nombre-de-la-tarea
```

---

## 7. Problemas frecuentes

| Problema | Solución |
|---|---|
| `psql` no se reconoce | Falta la carpeta `bin` de PostgreSQL en el PATH (punto 2.3); reabra Cmder. |
| `password authentication failed for user "gestantonia"` | La clave de `.env` no coincide con la del punto 2.4. |
| `database "gestantonia" does not exist` | Falta el `CREATE DATABASE` del punto 2.4. |
| `permission denied to create database` al correr las pruebas | Al usuario le falta `CREATEDB`: `ALTER USER gestantonia CREATEDB;` |
| `InconsistentMigrationHistory` con `admin.0001_initial` | Se migró antes de configurar `AUTH_USER_MODEL`: borre y vuelva a crear la base. |
| `venv\Scripts\activate` no funciona | Está en modo bash: use `source venv/Scripts/activate`. |
