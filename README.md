# GestAntonia

Sistema web de gestión para **Antonia Centro de Estética** (Calama): reservas, personal, ventas,
inventario y asistencia de sus tres locales.

Proyecto Integrado TIHV43 · INACAP Calama · Solución 1 (equipos 1, 4 y 5).

| | |
|---|---|
| Lenguaje y framework | Python 3.12 o superior · Django 5.2 LTS (patrón MVT) |
| Base de datos | PostgreSQL 16 o superior (probado en la 18) |
| Conexión | psycopg 3 · configuración en `.env` con python-dotenv |
| API para el frontend | Django REST Framework · SimpleJWT (tokens) · django-cors-headers |
| Frontend | React 19 · Vite · Tailwind CSS 4 (carpeta `frontend/`) |
| Sistema operativo de desarrollo | Windows 10/11 con la terminal integrada de VS Code (PowerShell) |

---

## Índice

1. [Requisitos](#1-requisitos)
2. [Instalación paso a paso](#2-instalación-paso-a-paso)
3. [Uso diario](#3-uso-diario)
4. [Frontend en React](#4-frontend-en-react)
5. [Pruebas automáticas](#5-pruebas-automáticas)
6. [Usuarios y datos de prueba](#6-usuarios-y-datos-de-prueba)
7. [Estructura del proyecto](#7-estructura-del-proyecto)
8. [Trabajo en equipo con Git](#8-trabajo-en-equipo-con-git)
9. [Ver la base de datos con DBeaver](#9-ver-la-base-de-datos-con-dbeaver)
10. [Problemas frecuentes](#10-problemas-frecuentes)

---

## 1. Requisitos

Instale estos programas una sola vez:

| Programa | Para qué | Cómo comprobar que quedó instalado |
|---|---|---|
| [Python 3.12+](https://www.python.org/downloads/) (marque *Add python.exe to PATH*) | Ejecutar Django | `python --version` |
| [Git](https://git-scm.com/download/win) | Descargar el código y subir cambios | `git --version` |
| [PostgreSQL 16+](https://www.postgresql.org/download/windows/) (puerto 5432) | Base de datos | `psql --version` |
| [Visual Studio Code](https://code.visualstudio.com/) | Editor y terminal | — |
| [Node.js 20.19+](https://nodejs.org/) (incluye npm) | Frontend en React | `node --version` |
| [DBeaver](https://dbeaver.io/download/) (opcional) | Ver las tablas y el diagrama | — |

Si `psql` no se reconoce, agregue `C:\Program Files\PostgreSQL\18\bin` a la variable de entorno
**Path** y abra una terminal nueva.

---

## 2. Instalación paso a paso

Todos los comandos se escriben en la terminal de VS Code (**Terminal → Nueva terminal**), en PowerShell.

### 2.1 Descargar el proyecto

```powershell
cd $HOME\Documents
git clone https://github.com/demonmasterkill421-gif/Proyecto_GestAntonia.git
cd Proyecto_GestAntonia
git switch Modulo/reservas
```

Luego abra la carpeta en VS Code: **Archivo → Abrir carpeta… → Proyecto_GestAntonia**.

### 2.2 Crear y activar el entorno virtual

```powershell
python -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

`requirements.txt` instala Django, el conector de PostgreSQL y los paquetes de la API que usa React
(Django REST Framework, SimpleJWT y django-cors-headers).

La línea de la terminal debe empezar con `(.venv)`. El `Set-ExecutionPolicy` solo vale para esa
terminal y permite activar el entorno; hay que repetirlo cada vez que se abre una terminal nueva.

### 2.3 Crear la base de datos en PostgreSQL

Entre con el superusuario `postgres` (la clave que definió al instalar PostgreSQL):

```powershell
psql -U postgres
```

Dentro de `psql`, cambie `una-clave-segura` por una clave suya:

```sql
CREATE USER gestantonia WITH PASSWORD 'una-clave-segura' CREATEDB;
CREATE DATABASE gestantonia OWNER gestantonia ENCODING 'UTF8';
\q
```

`CREATEDB` es necesario: las pruebas automáticas crean y borran una base temporal.

### 2.4 Configurar el archivo `.env`

El proyecto lee las claves desde `.env`, que **no se sube a GitHub** (está en `.gitignore`).

```powershell
Copy-Item .env.example .env
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
code .env
```

Complete `.env` así:

```ini
DJANGO_SECRET_KEY=<pegue aquí la clave que imprimió el comando anterior>
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=gestantonia
DB_USER=gestantonia
DB_PASSWORD=<la clave del CREATE USER>
DB_HOST=localhost
DB_PORT=5432
```

### 2.5 Crear las tablas y cargar los datos de prueba

```powershell
python manage.py migrate
python manage.py cargar_demo_reservas
python manage.py test
python manage.py runserver
```

| Comando | Resultado esperado |
|---|---|
| `migrate` | Una lista de `Applying ... OK` (la primera vez) |
| `cargar_demo_reservas` | `Demo de Reservas lista para el <fecha de hoy>` |
| `test` | `Ran 45 tests ... OK` |
| `runserver` | `Starting development server at http://127.0.0.1:8000/` |

Abra `http://127.0.0.1:8000/` en el navegador e ingrese con una de las cuentas de la
[sección 6](#6-usuarios-y-datos-de-prueba). Para apagar el servidor: `Ctrl + C`.

---

## 3. Uso diario

Cada vez que vuelva a trabajar:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
git switch Modulo/reservas
git pull
python manage.py migrate
python manage.py runserver
```

`git pull` trae lo que subieron los compañeros y `migrate` aplica sus cambios de tablas, si los hay
(`No migrations to apply` también está bien).

| Página | Dirección | Quién entra |
|---|---|---|
| Inicio de sesión y panel de cada rol | `http://127.0.0.1:8000/` | Todos |
| Agenda del día | `/reservas/agenda/` (otra fecha: `?fecha=AAAA-MM-DD`) | Recepcionista y administradora |
| Buscar o registrar cliente | `/reservas/clientes/buscar/` | Recepcionista y administradora |
| Nueva reserva | `/reservas/nueva/` | Recepcionista y administradora con local asignado |
| Administración (CRUD de todas las tablas) | `/admin/` | Administradora |
| API: iniciar sesión (devuelve el token) | `POST /api/login/` con `email` y `password` | Todos |
| API: datos de la cuenta | `GET /api/me/` con el token | Todos |

---

## 4. Frontend en React

El frontend de la Solución 1 está en `frontend/` y se conecta a Django por la API (`/api/...`)
con tokens JWT. Se necesitan **dos terminales**: Django en una y React en la otra.

La primera vez:

```powershell
cd frontend
npm install
Set-Content .env "VITE_API_URL="
```

`frontend/.env` no se sube a GitHub. Con `VITE_API_URL=` vacío, React usa el mismo servidor de Vite,
que reenvía `/api` a Django (`frontend/vite.config.js`).

Cada vez (con `python manage.py runserver` encendido en la otra terminal):

```powershell
cd frontend
npm run dev
```

Abra `http://localhost:5173/`. Tailwind es la versión 4: no se usa `tailwind.config.js`, PostCSS ni
autoprefixer. Para ver el frontend desde un celular en la misma red wifi: `npm run dev -- --host`.

Para compartirlo por internet en una prueba: en VS Code, pestaña **Puertos** → reenviar el `5173` →
clic derecho → **Port Visibility → Public**, y enviar la dirección que termina en `-5173` (solo se
comparte el 5173, nunca el 8000). Al terminar, vuelva a dejarlo en *Private*. Si Vite responde
«Blocked request. This host is not allowed», agregue `allowedHosts: true` dentro de `server` en
`frontend/vite.config.js`. La cámara para el QR solo funciona en páginas `https`, como la del puerto reenviado.

---

## 5. Pruebas automáticas

```powershell
python manage.py test               # todo el proyecto
python manage.py test reservas -v 2 # un módulo, con el nombre de cada prueba
python manage.py test reservas -k tope -v 2   # solo las pruebas cuyo nombre contiene "tope"
```

| Módulo | Pruebas | Qué revisan |
|---|---|---|
| `reservas` | 25 | Fin calculado por el servicio, cero topes, bloques seguidos, cancelación, filtro por local, permisos por rol, nueva reserva con horarios sugeridos, búsqueda y registro de clientes con consentimiento, datos de demostración |
| `usuarios` | 10 | Inicio de sesión con correo y acceso por rol |
| `ventas` | 6 | Registro de ventas, descuento de stock y folio por local |
| `asistencia` | 4 | Marcaje de entrada y salida con QR |
| **Total** | **45** | |

Las pruebas usan una base temporal (`test_gestantonia`) que se crea y se borra sola: no tocan los
datos de `gestantonia`. Sin PostgreSQL, se pueden correr con SQLite:
`$env:DB_ENGINE="sqlite"; python manage.py test`.

---

## 6. Usuarios y datos de prueba

`python manage.py cargar_demo_reservas` ejecuta primero `cargar_datos_demo` (locales, personal,
servicios, productos e inventario) y agrega los datos de Reservas. Se puede repetir sin duplicar:
cada vez deja las reservas de prueba como al principio. Con `--fecha 2026-11-03` las crea para otro día.

Clave de todas las cuentas: `Antonia2026!` (**solo para desarrollo**; cámbiela con datos reales).

| Cuenta | Rol | Local |
|---|---|---|
| `admin@gestantonia.cl` | Administradora | — (todos) |
| `paola@gestantonia.cl` | Recepcionista | Local Mall Plaza Calama |
| `rocio@gestantonia.cl` | Recepcionista | Local Centro 1 |
| `fernanda@gestantonia.cl` | Trabajadora, manicurista | Local Mall Plaza Calama |
| `camila@gestantonia.cl` | Trabajadora, cosmetóloga | Local Mall Plaza Calama |
| `liz@gestantonia.cl` | Trabajadora, depiladora | Local Centro 1 |

Reservas que se crean para el día indicado (hoy por defecto):

| Hora | Especialista | Cliente | Servicio | Local / estado |
|---|---|---|---|---|
| 10:00–11:00 | Fernanda | Valentina Muñoz | Manicura | Mall |
| 10:30–11:30 | Camila | Javiera Soto | Lifting de pestañas | Mall |
| 11:00–12:00 | Fernanda | Matías Rojas | Esmaltado permanente | Mall (seguida de la de 10:00) |
| 12:00–12:20 | Liz | Carolina Díaz | Depilación de rostro | Centro 1 (Paola no la ve) |
| 16:00–17:00 | Camila | Benjamín Pérez | Lifting de pestañas | Mall, **cancelada** |
| 17:00–18:30 | Fernanda | Javiera Soto | Diseño de uñas N°1 | Mall |

Y una más al día siguiente (Fernanda, 15:00, Carolina Díaz).

---

## 7. Estructura del proyecto

Una app de Django por bloque del diagrama de clases:

| App | Tablas | Contenido |
|---|---|---|
| `gestantonia/` | — | Configuración (`settings.py`) y rutas principales (`urls.py`), incluidas las de la API |
| `usuarios` | `usuarios_usuario` | Usuario con rol (Administrador, Recepcionista, Trabajador como modelos *proxy*), inicio de sesión con correo y decorador `@rol_requerido` |
| `locales` | `locales_local` | Los tres locales |
| `catalogo` | `catalogo_item`, `catalogo_servicio`, `catalogo_producto`, `catalogo_inventario` | Servicios y productos (herencia de `Item`) y stock por local |
| `reservas` (Equipo 4) | `reservas_cliente`, `reservas_reserva` | Clientes con consentimiento, reservas sin topes, agenda por local |
| `ventas` | `ventas_registrodeventa`, `ventas_detalleventa` | Ventas con detalle, folio por local y descuento de stock |
| `asistencia` | `asistencia_registrodeasistencia`, `asistencia_codigoqr` | Marcaje con QR y corrección con motivo |
| `frontend/` | — | Aplicación React: `src/pages` (pantallas por rol), `src/components`, `src/api` (llamadas a Django) y `src/auth` (sesión con token) |

Dentro de cada app: `models.py` (tablas y reglas), `views*.py` (lógica de cada pantalla),
`urls.py` (direcciones), `admin.py` (panel de administración), `migrations/` (historial de cambios
de las tablas) y `tests/` o `tests.py` (pruebas). Las pantallas están en `templates/` y los estilos
en `static/css/`.

Tablas que no estaban en el diagrama de clases: `ventas_detalleventa`, `catalogo_inventario` y
`asistencia_codigoqr`. El diagrama de la base está en `docs/Diagrama_DB_GestAntonia.png`.

Reglas de negocio y seguridad implementadas:

- Una especialista no puede tener dos reservas que se crucen (cero topes); la hora de término se
  calcula con la duración del servicio. Ante un tope, el sistema sugiere los horarios libres más cercanos.
- Cancelar exige un motivo y no borra la reserva: el bloque queda libre y el registro se conserva.
- Cada recepcionista solo ve y agenda en su local; el local sale de su cuenta, no de la dirección.
- No se registra un cliente sin su consentimiento (leyes 19.628 y 21.719).
- Acceso por rol en cada vista; contraseñas con hash PBKDF2; la sesión se cierra tras 30 minutos sin
  actividad; claves y datos de conexión fuera del código (`.env`).
- Al confirmar una venta se descuenta el stock y se asigna un folio correlativo por local; anularla
  devuelve el stock. La comisión se calcula sobre el monto total con el porcentaje de cada trabajadora.

---

## 8. Trabajo en equipo con Git

- `main` es la rama estable: **nadie sube directo a `main`**.
- Cada módulo tiene su rama (`Modulo/reservas`, `Modulo/inventario`, …).
- Antes de empezar: `git pull`. Antes de subir: `python manage.py test` debe terminar en `OK`.
- Suba solo sus archivos, con un mensaje que diga qué hizo:

```powershell
git status
git add <archivos>
git commit -m "Reservas 2.1: reprogramar reserva"
git push
```

- **Migraciones:** solo una persona por módulo modifica `models.py` y genera migraciones
  (`python manage.py makemigrations`). La migración se sube junto con el cambio del modelo.
  Nunca se editan ni se borran migraciones ya subidas.
- Nunca se suben `.env`, `frontend/.env`, `.venv/`, `node_modules/`, `db.sqlite3` ni `__pycache__/` (ya están en los `.gitignore`).
- Para traer a su rama lo nuevo de `main` (por ejemplo, el frontend): `git fetch` y `git merge origin/main`.

---

## 9. Ver la base de datos con DBeaver

1. **Database → New Database Connection → PostgreSQL**.
2. Host `localhost`, puerto `5432`, base `gestantonia`, usuario `gestantonia` y la clave del `.env`
   (marque *Save password*). **Test Connection**; la primera vez acepte descargar el driver.
3. Para el diagrama: **Databases → gestantonia → Schemas → public → Tables**, seleccione las tablas
   con `Ctrl + clic` → clic derecho → **View Diagram**. Para exportarlo: clic derecho sobre el fondo →
   **Save diagram as…**

---

## 10. Problemas frecuentes

| Mensaje | Solución |
|---|---|
| «la ejecución de scripts está deshabilitada» | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` y vuelva a activar el entorno |
| `No module named django` | El entorno no está activo: `.\.venv\Scripts\Activate.ps1` |
| `No module named 'rest_framework'` o `'corsheaders'` | Faltan los paquetes de la API: `pip install -r requirements.txt` |
| `npm` no se reconoce | Instale Node.js y abra una terminal nueva |
| React muestra error de red al iniciar sesión | Django no está encendido, o `frontend/.env` no tiene `VITE_API_URL=` vacío |
| `connection refused` / «no se pudo conectar» | PostgreSQL está detenido: **Servicios** de Windows → `postgresql-x64-18` → **Iniciar** |
| `password authentication failed` | La `DB_PASSWORD` del `.env` no coincide con la del `CREATE USER` |
| `permission denied to create database` (al correr pruebas) | Falta `CREATEDB`: en `psql -U postgres`, `ALTER USER gestantonia CREATEDB;` |
| `Port 8000 is already in use` | Ya hay un servidor encendido: ciérrelo o use `python manage.py runserver 8001` |
| `error: pathspec 'Modulo/reservas'` | `git fetch` y repita el `git switch` |
| La agenda sale vacía | No hay reservas ese día: `python manage.py cargar_demo_reservas` o cambie `?fecha=` |
| Tras copiar archivos a mano, Django sigue usando la versión anterior | Borre las carpetas `__pycache__` del proyecto (no las de `.venv`) |
