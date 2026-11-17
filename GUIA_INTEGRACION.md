# GestAntonia: inventario con componentes React

Integración del 2 de noviembre: se usó la versión de tu compañero como base y se incorporó tu inventario original y su adaptación a componentes React. Se conservaron RutaPrivada, los paneles por rol, SeccionResumen y los cambios del menú de tu compañero.

## Ejecutar en Windows

Abre una terminal en la carpeta que contiene manage.py. Necesitas Python 3.12 o posterior compatible con Django 5.2 y Node.js compatible con Vite 8 (por ejemplo Node 24).

```bat
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

El ejemplo usa SQLite para probar sin configurar PostgreSQL. Si ya tienes un archivo .env y una base de datos configurada, consérvalos: no ejecutes el comando copy sobre ellos. Los modelos no se modificaron.

En una segunda terminal, dentro de la carpeta frontend:

```bat
npm ci
npm run dev
```

Abre http://localhost:5173 e inicia sesión con el correo y la contraseña del superusuario. En el menú, entra en Inventario; la ruta es http://localhost:5173/admin/inventario.

El frontend usa el proxy de Vite hacia Django en localhost:8000. No hace falta crear frontend/.env. Si defines VITE_API_URL, debe ser la raíz del servidor (por ejemplo http://localhost:8000), sin /api al final. Reinicia Vite después de cambiar sus variables.

## Agregar datos reales

En http://localhost:8000/admin/ ingresa con el correo del superusuario y crea:

1. Un local, si todavía no existe.
2. Productos con nombre, precio y tipo (venta o insumo).
3. Registros de inventario que relacionen producto y local, con cantidad y stock mínimo.

Crear un producto no crea automáticamente su existencia por local. La tabla React muestra registros de Inventario. No se agregaron datos ficticios ni se reemplazó tu base de datos.

## Componentes

- `frontend/src/pages/administrador/inventario/Inventario.jsx`: verifica la sesión, consulta la API y coordina los componentes.
- `frontend/src/components/inventario/BuscadorInventario.jsx`: búsqueda por nombre, filtro por local y stock bajo.
- `frontend/src/components/inventario/TablaInventario.jsx`: recorre los resultados con `.map()` y presenta existencias.
- `frontend/src/components/inventario/ResumenInventario.jsx`: totales generales, antes de aplicar la búsqueda, como en tu vista Django original. Los productos se cuentan sin duplicarlos entre locales.
- `frontend/src/components/Sidebar.jsx`: menú compartido, ahora con acceso a Inventario.
- `frontend/src/api/inventario.api.js`: solicitudes HTTP a Django.
- `catalogo/api.py`: valida filtros, aplica permisos y devuelve JSON.
- `catalogo/api_urls.py`: rutas de la API. `catalogo/urls.py` conserva la ruta de tu vista Django original.

El selector global antiguo utiliza locales de ejemplo. Se oculta únicamente en Inventario: esa pantalla tiene su propio filtro con los locales reales de la base de datos.

## Cómo funciona la búsqueda

El campo de React actualiza su estado con useState. Luego useEffect consulta la API después de 250 ms. Axios envía el token de la sesión. Django verifica que el usuario sea administrador y ejecuta:

```python
registros = registros.filter(producto__nombre__icontains=datos["busqueda"])
```

Django convierte los registros a JSON mediante el serializer. React recibe la lista y TablaInventario la muestra con `.map()`. Las solicitudes anteriores se cancelan al cambiar los filtros para evitar resultados desactualizados.

La alerta se muestra cuando cantidad es menor o igual al stock mínimo, como establece el modelo existente. El inventario es de consulta: altas y cambios de existencias se realizan en el administrador de Django. Las otras opciones del menú que eran prototipos conservan su estado original.

## Comprobar

```bat
python manage.py test
```

En frontend:

```bat
npm run build
npx oxlint src/components/inventario src/pages/administrador/inventario src/api/inventario.api.js
```

Las pruebas del inventario cubren permisos, filtros, resultados vacíos, stock mínimo e inicio de sesión JWT. La compilación verifica los componentes; no sustituye una prueba visual en tu navegador.


## Qué se integró y qué copiar

El ZIP es el proyecto completo actualizado. Extráelo en otra carpeta para probar; conserva tu .env y tu base PostgreSQL actual. Si necesitas incorporarlo a tu repositorio existente, no copies .venv, node_modules ni una base SQLite de pruebas.

Archivos del compañero modificados:

- frontend/src/App.jsx: ruta /admin/inventario dentro de RutaPrivada para ADMIN.
- frontend/src/components/Sidebar.jsx: opción Inventario; conserva encabezado fijo y etiqueta Ventas.
- frontend/src/api/client.js: raíz / por defecto para usar el proxy sin depender de un .env ausente.
- gestantonia/urls.py: rutas nuevas del catálogo.
- requirements.txt: incluye REST Framework y django-cors-headers, utilizados por settings.py.

Archivos añadidos:

- catalogo/api.py, catalogo/api_urls.py y catalogo/tests.py.
- frontend/src/api/inventario.api.js.
- frontend/src/pages/administrador/inventario/Inventario.jsx.
- frontend/src/components/inventario/: BuscadorInventario, TablaInventario, ResumenInventario.
- .env.example, frontend/.env.example y esta guía.

También se recuperaron de tu ZIP anterior, sin modificar su contenido: catalogo/views.py, catalogo/urls.py, templates/catalogo/inventario.html y static/css/inventario.css.

La pantalla original está en http://localhost:8000/inventario/ con sesión Django. React usa http://localhost:5173/admin/inventario con sesión JWT. Cada interfaz tiene su propio inicio de sesión, pero ambas consultan los mismos modelos y base de datos configurada.

No se modificaron modelos ni migraciones. Las altas y cambios de productos siguen en el administrador Django. No se implementaron las opciones pendientes de otros módulos ni el historial de movimientos.

## Validación realizada

- 26 pruebas Django aprobadas, incluida búsqueda, filtros, permisos, JWT, totales generales y pantalla original.
- Compilación de producción de React correcta.
- Análisis estático de los componentes de inventario sin avisos.
- No hay nuevas migraciones pendientes de generar.
- Los archivos preexistentes del compañero permanecen idénticos salvo los cinco indicados arriba.

Las pruebas de base de datos se ejecutaron con SQLite temporal; PostgreSQL debe verificarse con tu configuración local.

No se completó la prueba visual automatizada: el navegador de pruebas no estaba disponible y su descarga falló. Revisa la apariencia en tu navegador al iniciarlo.
