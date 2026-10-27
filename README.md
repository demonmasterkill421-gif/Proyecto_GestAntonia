GestAntonia
Sistema de gestión de ventas y asistencia para Estética Antonia.
Backend: Django + Django REST Framework + PostgreSQL (autenticación con JWT).
Frontend: React + Vite + Tailwind CSS v4.
Roles: Administradora (propietaria), Recepcionista y Trabajador/a (especialista).
```
Proyecto_GestAntonia/
  backend (Django: manage.py, apps, requirements.txt, .env)
  frontend/ (React: package.json, src/, .env)
  docs/
```
Requisitos previos
Instalar en el computador antes de empezar:
Herramienta	Para qué	Versión
Python	Backend	3.10 o superior
PostgreSQL	Base de datos	18 (la que propone el instalador)
Node.js (incluye npm)	Frontend	20.19 o superior (se recomienda la última LTS)
Git	Control de versiones	Cualquiera reciente
DBeaver (opcional)	Ver la base y el diagrama	Cualquiera reciente
Comprobar versiones:
    python --version
    node --version
    npm --version

---
1. Configuración de PostgreSQL
Puerto: 5432 (el que propone el instalador).
Base de datos: gestantonia
Usuario: gestantonia (con permiso CREATEDB, necesario para correr las pruebas).
Crear el usuario y la base, entrando con el superusuario postgres:
    psql -U postgres

Luego, dentro de psql:
    CREATE USER gestantonia WITH PASSWORD 'una-clave-segura' CREATEDB;
    CREATE DATABASE gestantonia OWNER gestantonia ENCODING 'UTF8';
    \q

Si psql no se reconoce, agreguen `C:\Program Files\PostgreSQL\18\bin` a la variable Path y reabran la consola.
El proyecto lee la conexión desde el archivo `.env` (que no se sube a GitHub). Para crearlo:
    copy .env.example .env

Y completen estos valores:
    DB_NAME=gestantonia
    DB_USER=gestantonia
    DB_PASSWORD=La clave creada en CREATE USER
    DB_HOST=localhost
    DB_PORT=5432
    DJANGO_SECRET_KEY=una clave aleatoria (se genera con: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")

2. Configuración de DBeaver
Nueva conexión: Database > New Database Connection > PostgreSQL.
Host: localhost / Port: 5432 / Database: gestantonia
Usuario: gestantonia / Password: la misma del .env (marque Save password).
Test Connection. La primera vez acepte descargar el driver.
Para ver el diagrama: Databases > gestantonia > Schemas > public > Tables, seleccione las tablas
del proyecto con Ctrl + clic y use clic derecho > View Diagram.
Para exportarlo: clic derecho sobre el fondo del diagrama > Save diagram as... y guárdelo en
`docs\diagrama_bd_dbeaver.png`. En `docs\diagrama_bd_referencia.png` hay uno de referencia para comparar.
3. Backend: migraciones y arranque
Con el entorno virtual activo, instalar dependencias y crear las tablas:
    pip install -r requirements.txt
    python manage.py migrate
    python manage.py cargar_datos_demo
    python manage.py test
    python manage.py runserver

Las migraciones ya vienen en cada app (carpetas migrations). No hay que generarlas de nuevo.
Use `python manage.py makemigrations` solo cuando cambie un models.py, y suba la migración nueva junto
con ese cambio. Conviene que una sola persona a la vez modifique los modelos.
settings.py define `AUTH_USER_MODEL = "usuarios.Usuario"`. Debe estar antes del primer migrate; si alguien
migró sin él, hay que borrar la base, crearla de nuevo y volver a ejecutar migrate.
`python manage.py test` debe terminar con: Ran 20 tests ... OK
Dependencias del backend para conectar con React
Además de Django, el backend necesita estos paquetes (deben estar en `requirements.txt`):
Paquete	Para qué
djangorestframework	API REST
djangorestframework-simplejwt	Inicio de sesión con tokens JWT
django-cors-headers	Permitir que el frontend llame a la API
Si falta alguno:
    python -m pip install djangorestframework djangorestframework-simplejwt django-cors-headers

> En Windows, si `pip` falla, usar siempre `python -m pip`.
Endpoints de autenticación disponibles:
Método	Ruta	Qué hace
POST	`/api/login/`	Recibe `email` y `password`; devuelve `access`, `refresh` y `usuario` (con `rol` y `local`)
GET	`/api/me/`	Devuelve el usuario de la sesión (requiere token)
POST	`/api/token/refresh/`	Renueva el token de acceso
`CORS_ALLOW_ALL_ORIGINS` es solo para desarrollo; hay que restringirlo antes de publicar.
4. Detalles del programa
Aplicaciones y tablas (una app por bloque del diagrama de clases):
usuarios: tabla usuarios_usuario. Administrador, Recepcionista y Trabajador son modelos proxy de
Usuario (comparten la tabla y se distinguen por el campo rol). Se inicia sesión con el correo.
locales: tabla locales_local.
catalogo: tablas catalogo_item, catalogo_servicio, catalogo_producto y catalogo_inventario
(stock de cada producto por local). Servicio y Producto heredan de Item.
ventas: tablas ventas_registrodeventa y ventas_detalleventa (ítems de cada venta).
asistencia: tablas asistencia_registrodeasistencia y asistencia_codigoqr.
Tablas que no estaban en el diagrama de clases: ventas_detalleventa, catalogo_inventario y
asistencia_codigoqr.
Funcionamiento:
El inicio de sesión está en el frontend (`http://localhost:5173/login`) y redirige a la página principal
de cada rol. El backend responde en `http://127.0.0.1:8000/api/...`.
`http://127.0.0.1:8000/admin/` es el CRUD de locales, usuarios, catálogo, inventario, ventas y asistencia
(solo administradora).
La sesión se cierra sola tras 30 minutos sin actividad.
Las contraseñas se guardan cifradas (hash PBKDF2).
Al confirmar una venta se descuenta el stock del local y se asigna un folio de boleta correlativo
por local. Una venta anulada devuelve el stock.
La comisión de cada trabajadora se calcula sobre el monto total con su porcentaje de comisión.
La asistencia se marca escaneando el QR del local: el primer escaneo del día es la entrada y el
segundo la salida. La administradora puede corregir un marcaje indicando el motivo.
Usuarios de prueba (creados por cargar_datos_demo, clave `Antonia2026!` para todos; solo para desarrollo):
admin@gestantonia.cl - Administradora
paola@gestantonia.cl - Recepcionista, Local Mall Plaza Calama
fernanda@gestantonia.cl - Trabajadora, manicurista
liz@gestantonia.cl - Trabajadora, depiladora
---
5. Frontend (React)
Tecnologías y dependencias
Paquete	Para qué
react, react-dom (19)	Interfaz
vite y @vitejs/plugin-react	Servidor de desarrollo y compilación
react-router-dom (7)	Rutas y navegación
tailwindcss (4) y @tailwindcss/vite	Estilos
axios	Llamadas a la API
lucide-react	Íconos
Las versiones exactas están en `frontend/package.json`. No se instalan una por una: con `npm install` se instala todo.
> **Tailwind v4:** no existe `tailwind.config.js` ni `postcss.config.js`. Los estilos arrancan con `@import "tailwindcss";`
> en `src/index.css` y el plugin `@tailwindcss/vite` en `vite.config.js`. No instalar Tailwind v3, ni
> `postcss`, ni `autoprefixer`: mezclar versiones rompe los estilos.
Si alguien agrega una dependencia nueva (`npm install nombre-paquete`), debe subir `package.json` y
`package-lock.json` en el mismo commit, y avisar al equipo.
Instalación
    cd frontend
    npm install
    copy .env.example .env

Variables de `frontend/.env`:
    VITE_API_URL=

Se deja vacía: el frontend llama a `/api/...` y Vite reenvía esas peticiones a Django
(`http://127.0.0.1:8000`) mediante el proxy de `vite.config.js`. Así funciona igual en cualquier computador,
incluso al compartir el puerto con otra persona.
El archivo `.env` no se sube a GitHub (debe estar en `.gitignore`). Las variables `VITE_` son públicas:
nunca poner claves ahí.
Cada cambio en `.env` o en `vite.config.js` requiere detener y volver a iniciar `npm run dev`.
Cómo correr el proyecto
Se necesitan dos terminales abiertas a la vez:
Terminal	Carpeta	Comando	Dirección
1 (backend)	raíz del backend, con el entorno virtual activo	`python manage.py runserver`	http://127.0.0.1:8000
2 (frontend)	`frontend`	`npm run dev`	http://localhost:5173
Abrir http://localhost:5173/login e iniciar sesión con un usuario de prueba (ver sección 4).
Otros comandos del frontend:
    npm run build      (compila para producción)
    npm run lint       (revisa el código, si está configurado)

Estructura de carpetas (`frontend/src`)
```
src/
  api/          cliente axios (client.js) y funciones de la API (usuario.api.js, ventas.api.js...)
  assets/       imágenes y logo
  auth/         AuthContext (sesión y token)
  components/   componentes compartidos: Sidebar, SelectorSucursal, TarjetaSucursal, Bienvenida...
  config/       roles.js (a qué página va cada rol al iniciar sesión)
  data/         datos de ejemplo y funciones de apoyo (se reemplazan al conectar el backend)
  hooks/        hooks propios (useTitulo)
  sucursal/     SucursalContext (sucursal elegida por la propietaria)
  pages/
    login.jsx
    administrador/<modulo>/
    recepcionista/<modulo>/
    trabajador/<modulo>/
    asistencia/   (pantalla compartida por administradora y recepcionista)
  App.jsx       todas las rutas
```
Rutas
Ruta	Pantalla	Rol
`/login`	Inicio de sesión	Todos
`/admin/inicio`	Inicio de la propietaria	ADMIN
`/admin/locales`	Selector de sucursal	ADMIN
`/recepcionista/inicio`	Inicio de la recepcionista	RECEP
`/especialista/inicio`	Inicio del trabajador (celular)	TRAB
`/asistencia`	Asistencia del día	ADMIN y RECEP
Cualquier dirección no registrada redirige a `/login`.
> Hoy el frontend solo **oculta** opciones según el rol. La seguridad real (quién puede ver o modificar qué)
> debe validarse siempre en Django, en cada endpoint y filtrando por local.
Cómo agregar una página nueva
Crear el archivo en `src/pages/<rol>/<modulo>/` con una función exportada con nombre
(`export function MiPagina()`).
Usar `<Sidebar>` como envoltorio (menos login y la pantalla del trabajador) y `useTitulo("Nombre")`:
```jsx
import { Sidebar } from "../../../components/Sidebar";
import { useTitulo } from "../../../hooks/useTitulo";

export function MiPagina() {
  useTitulo("Mi página");
  return (
    <Sidebar>
      <h1>Contenido</h1>
    </Sidebar>
  );
}
```
En `App.jsx`: importar la página y agregar su `<Route>` antes de la ruta `*`.
Si debe aparecer en el menú, agregarla en `MENU` dentro de `components/Sidebar.jsx`, con la misma ruta.
Convenciones
Componentes y páginas: un archivo `.jsx` por componente, nombre en PascalCase (`TarjetaSucursal.jsx`).
Exportar con nombre (`export function X`) e importar con llaves (`import { X } from ...`).
Las mayúsculas y minúsculas de los imports deben coincidir exactamente con el nombre del archivo.
Los componentes que usa un solo módulo van en su carpeta; los compartidos, en `src/components/`.
Guardar siempre con Ctrl+S (conviene activar Archivo > Autoguardado en VS Code).
Colores de la marca: `#b5368f` (magenta), `#f7e3f1` y `#fbeef6` (rosados), `#faf9f7` (fondo).
Problemas frecuentes
Síntoma	Causa probable y solución
Página en blanco	Abrir F12 > Console (o mirar la terminal de `npm run dev`). Casi siempre es un import mal escrito, un archivo en otra carpeta o un archivo sin guardar.
`Failed to resolve import "..."`	La ruta o el nombre del archivo no coincide (revisar mayúsculas y la cantidad de `../`).
`does not provide an export named 'X'`	Falta exportar `X` en ese archivo, o un ícono de `lucide-react` fue renombrado en la versión instalada.
`Can't resolve 'tailwindcss'` o la página sin estilos	Versiones de Tailwind mezcladas. Revisar la nota de Tailwind v4 y volver a ejecutar `npm install`.
Error 502 al iniciar sesión	Django no está corriendo, o falta usar `127.0.0.1` en lugar de `localhost` en el proxy.
Error 404 en `/api/...`	Ese endpoint todavía no existe en Django.
`Cannot read properties of null (reading 'iniciarSesion')`	`AuthProvider` debe envolver a `BrowserRouter` en `App.jsx`.
Cambié `.env` y no pasa nada	Reiniciar `npm run dev`.
Mostrar la app a otra persona
Misma red wifi: `npm run dev -- --host` y compartir la dirección `http://192.168.x.x:5173` que muestra Vite.
Por internet (puertos de VS Code): pestaña Puertos > clic derecho sobre 5173 > Port Visibility > Public.
Compartir solo el 5173 (no el 8000). La cámara del QR solo funciona en páginas `https`, como la del túnel.
Volver a poner el puerto en Privado al terminar.
Si Vite responde `Blocked request. This host is not allowed`, agregar `allowedHosts: true` dentro de
`server` en `vite.config.js`.
---
6. Trabajo en equipo (Git)
Antes de empezar a trabajar: `git pull`.
No subir `.env`, `node_modules/` ni la carpeta del entorno virtual (revisar `.gitignore`).
Si borran un archivo, ese borrado también hay que commitearlo.
Conviene que una sola persona a la vez modifique `models.py` y `App.jsx`/`Sidebar.jsx` (archivos que todos tocan),
y avisar al resto antes de hacerlo.