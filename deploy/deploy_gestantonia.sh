#!/usr/bin/env bash
# =====================================================================
#  GestAntonia · despliegue en un VPS Ubuntu 24.04 (AWS Lightsail/EC2 o Hostinger KVM)
#  Instala y configura: PostgreSQL + Django/DRF con Gunicorn + React (build) + Nginx
#  y, si se puede, HTTPS gratuito con Let's Encrypt.
#
#  Uso (como root o con sudo):
#      sudo bash deploy_gestantonia.sh
#  Variables opcionales (se anteponen al comando):
#      DOMINIO=midominio.cl        dominio propio ya apuntado a la IP (si no, se usa <ip>.sslip.io)
#      HTTPS=no                    no pedir certificado (queda solo en http)
#      CERTBOT_EMAIL=correo@x.cl   correo para avisos de Let's Encrypt
#      CARGAR_DEMO=si              carga los datos de prueba (cargar_datos_demo)
#      BRANCH=main                 rama del repositorio a desplegar
#  Para ACTUALIZAR el servidor después de un push, se vuelve a ejecutar el mismo comando.
# =====================================================================
set -Eeuo pipefail
trap 'echo -e "\n[X] Falló la línea $LINENO: $BASH_COMMAND" >&2' ERR

REPO_URL="${REPO_URL:-https://github.com/demonmasterkill421-gif/Proyecto_GestAntonia.git}"
BRANCH="${BRANCH:-main}"
BASE="${BASE:-/opt/gestantonia}"
APP="$BASE/app"
VENV="$BASE/venv"
USUARIO="${USUARIO:-gestantonia}"
DB_NAME="${DB_NAME:-gestantonia}"
DB_USER="${DB_USER:-gestantonia}"
HTTPS="${HTTPS:-si}"
CARGAR_DEMO="${CARGAR_DEMO:-no}"
UFW="${UFW:-si}"

paso() { echo -e "\n\033[1;36m==> $*\033[0m"; }
aviso() { echo -e "\033[1;33m[!] $*\033[0m"; }
# Ejecuta como el usuario de la app (conserva PATH y, si existe, la configuración de proxy)
PASAR_ENV=()
for v in HTTPS_PROXY https_proxy HTTP_PROXY http_proxy NO_PROXY no_proxy NODE_EXTRA_CA_CERTS SSL_CERT_FILE PIP_CERT REQUESTS_CA_BUNDLE; do
  if [ -n "${!v:-}" ]; then PASAR_ENV+=("$v=${!v}"); fi
done
como_app() { sudo -u "$USUARIO" -H env HOME="/home/$USUARIO" PATH="$PATH" "${PASAR_ENV[@]}" "$@"; }

[ "$(id -u)" -eq 0 ] || { echo "Ejecute con sudo: sudo bash $0"; exit 1; }
export DEBIAN_FRONTEND=noninteractive

# Al encender la instancia, Ubuntu instala sus actualizaciones automáticas y deja apt ocupado
# unos minutos. apt_seguro espera a que se libere (hasta 10 min por intento) y reintenta,
# en vez de cortar el despliegue a la mitad (pasó el 17-11 y el sitio quedó sin HTTPS).
apt_seguro() {
  local intento
  for intento in 1 2 3 4 5; do
    apt-get -o DPkg::Lock::Timeout=600 "$@" && return 0
    echo "apt está ocupado (actualizaciones de Ubuntu). Reintento $intento de 5 en 30 s..."
    sleep 30
  done
  return 1
}

# ---------------------------------------------------------------- 1. paquetes
paso "1/9 Instalando paquetes del sistema"
apt_seguro update -q
apt_seguro install -y -q git curl ca-certificates openssl python3-venv python3-pip \
    postgresql postgresql-contrib nginx ufw >/dev/null

NODE_MAJOR=$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || true)
if [ -z "${NODE_MAJOR}" ] || [ "${NODE_MAJOR}" -lt 22 ]; then
  paso "Instalando Node.js 22 (Vite 8 no funciona con el Node 18 de Ubuntu)"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt_seguro install -y -q nodejs >/dev/null
fi
echo "Python $(python3 -V | cut -d' ' -f2) · Node $(node -v) · $(psql -V | cut -d' ' -f1,3)"

# Los planes de 1-2 GB se quedan sin memoria al compilar React: se agrega swap de 2 GB.
if [ "$(free -m | awk '/^Mem:/{print $2}')" -lt 3000 ] && [ "$(swapon --noheadings | wc -l)" -eq 0 ]; then
  paso "Creando swap de 2 GB"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------------------------------------------------------------- 2. IP y dominio
IP_PUBLICA="${IP_PUBLICA:-$(curl -fsS --max-time 5 https://checkip.amazonaws.com 2>/dev/null | tr -d '[:space:]' || true)}"
[ -n "$IP_PUBLICA" ] || IP_PUBLICA=$(hostname -I | awk '{print $1}')
DOMINIO="${DOMINIO:-${IP_PUBLICA//./-}.sslip.io}"
echo "IP pública: $IP_PUBLICA · dominio: $DOMINIO"

# ---------------------------------------------------------------- 3. usuario y código
paso "2/9 Usuario del sistema y código fuente ($BRANCH)"
id "$USUARIO" &>/dev/null || useradd --system --create-home --home-dir "/home/$USUARIO" --shell /usr/sbin/nologin "$USUARIO"
mkdir -p "$BASE" && chown "$USUARIO:$USUARIO" "$BASE" && chmod 755 "$BASE"
if [ -d "$APP/.git" ]; then
  como_app git -C "$APP" fetch --quiet origin "$BRANCH"
  como_app git -C "$APP" checkout --quiet "$BRANCH"
  como_app git -C "$APP" reset --quiet --hard "origin/$BRANCH"     # el servidor no guarda cambios propios
else
  como_app git clone --quiet --branch "$BRANCH" "$REPO_URL" "$APP"
fi
echo "Versión desplegada: $(como_app git -C "$APP" log -1 --format='%h · %s')"

# ---------------------------------------------------------------- 4. PostgreSQL
paso "3/9 Base de datos PostgreSQL"
systemctl enable --now postgresql >/dev/null 2>&1 || true
ENV_FILE="$APP/.env"
leer_env() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true; }
DB_PASSWORD="$(leer_env DB_PASSWORD)"
[ -n "$DB_PASSWORD" ] || DB_PASSWORD="$(openssl rand -hex 24)"
SECRET_KEY="$(leer_env DJANGO_SECRET_KEY)"
[ -n "$SECRET_KEY" ] || SECRET_KEY="$(openssl rand -base64 48 | tr -d '\n/+=')"

sudo -u postgres psql -q -v ON_ERROR_STOP=1 \
  -v usr="$DB_USER" -v pwd="$DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN', :'usr') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'usr') \gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'usr', :'pwd') \gexec
SQL
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
  || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
echo "Base '$DB_NAME' lista (dueño: $DB_USER)"

# ---------------------------------------------------------------- 5. .env de producción
paso "4/9 Archivo .env de producción (no se sube a GitHub)"
ORIGENES="https://$DOMINIO,http://$DOMINIO,http://$IP_PUBLICA"
cat > "$ENV_FILE" <<EOF
# Generado por deploy_gestantonia.sh · $(date '+%F %T')
DJANGO_SECRET_KEY=$SECRET_KEY
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=$DOMINIO,$IP_PUBLICA,localhost,127.0.0.1
DJANGO_CSRF_TRUSTED_ORIGINS=$ORIGENES
DJANGO_CORS_ORIGINS=$ORIGENES
FRONTEND_URL=https://$DOMINIO
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_HOST=localhost
DB_PORT=5432
EOF
chown "$USUARIO:$USUARIO" "$ENV_FILE" && chmod 600 "$ENV_FILE"

# ---------------------------------------------------------------- 6. backend
paso "5/9 Backend: entorno virtual, dependencias, migraciones y archivos estáticos"
[ -x "$VENV/bin/python" ] || como_app python3 -m venv "$VENV"
como_app "$VENV/bin/pip" install -q --disable-pip-version-check --upgrade pip
como_app "$VENV/bin/pip" install -q --disable-pip-version-check -r "$APP/requirements.txt" gunicorn
MANAGE() { como_app bash -c "cd '$APP' && '$VENV/bin/python' manage.py $*"; }
MANAGE migrate --noinput
MANAGE collectstatic --noinput --clear -v 0
MANAGE check --deploy --fail-level CRITICAL 2>/dev/null | tail -1 || true
if [ "$CARGAR_DEMO" = "si" ]; then
  aviso "Cargando datos de prueba: cambie las claves demo antes de mostrar el sistema"
  MANAGE cargar_datos_demo
fi

# ---------------------------------------------------------------- 7. frontend
paso "6/9 Frontend: compilando React (npm ci + npm run build)"
como_app bash -c "cd '$APP/frontend' && npm ci --cache /home/$USUARIO/.npm --no-audit --no-fund --loglevel=error && VITE_API_URL= npm run build" | tail -4

# ---------------------------------------------------------------- 8. Gunicorn (systemd)
paso "7/9 Servicio Gunicorn"
cat > /etc/systemd/system/gestantonia.service <<EOF
[Unit]
Description=GestAntonia (Django + Gunicorn)
After=network.target postgresql.service

[Service]
User=$USUARIO
Group=$USUARIO
WorkingDirectory=$APP
ExecStart=$VENV/bin/gunicorn gestantonia.wsgi:application --bind 127.0.0.1:8000 --workers 3 --timeout 60 --access-logfile -
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
if [ -d /run/systemd/system ]; then
  systemctl daemon-reload
  systemctl enable gestantonia >/dev/null 2>&1
  systemctl restart gestantonia
else
  aviso "Este equipo no usa systemd: inicie Gunicorn a mano"
fi

# ---------------------------------------------------------------- 9. Nginx
paso "8/9 Nginx (React en la raíz, Django en /api, /admin, /reservas, /panel, /login/)"
IPV6=""; [ -e /proc/net/if_inet6 ] && IPV6="listen [::]:80;"
cat > /etc/nginx/sites-available/gestantonia <<EOF
server {
    listen 80;
    $IPV6
    server_name $DOMINIO $IP_PUBLICA _;
    client_max_body_size 10m;

    root $APP/frontend/dist;          # build de React
    index index.html;

    # Archivos estáticos de Django (admin, css de reservas)
    location /static/ { alias $APP/staticfiles/; expires 7d; access_log off; }
    location /assets/ { try_files \$uri =404; expires 30d; access_log off; }

    # Pantallas de React que comparten prefijo con Django (tienen prioridad por ser regex)
    # index.html sin caché: tras cada despliegue el navegador pide la versión nueva
    # (los archivos de /assets/ llevan un código único por versión, por eso sí se guardan 30 días)
    location ~ ^/admin/(inicio|locales|ventas|asistencia|reportes|inventario|inventario/registrar)/?\$ { add_header Cache-Control "no-cache" always; try_files /index.html =404; }
    location = /login { add_header Cache-Control "no-cache" always; try_files /index.html =404; }
    location = /index.html { add_header Cache-Control "no-cache" always; }

    # Django: API REST, admin de Django y módulos con templates
    location /api/      { include /etc/nginx/snippets/gestantonia_proxy.conf; }
    location /admin/    { include /etc/nginx/snippets/gestantonia_proxy.conf; }
    location /reservas/ { include /etc/nginx/snippets/gestantonia_proxy.conf; }
    location /panel/    { include /etc/nginx/snippets/gestantonia_proxy.conf; }
    location = /login/  { include /etc/nginx/snippets/gestantonia_proxy.conf; }
    location = /logout/ { include /etc/nginx/snippets/gestantonia_proxy.conf; }

    # Todo lo demás es la SPA de React (BrowserRouter)
    location / { try_files \$uri /index.html; }
}
EOF
cat > /etc/nginx/snippets/gestantonia_proxy.conf <<'EOF'
proxy_pass http://127.0.0.1:8000;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_read_timeout 60s;
EOF
ln -sf /etc/nginx/sites-available/gestantonia /etc/nginx/sites-enabled/gestantonia
rm -f /etc/nginx/sites-enabled/default
nginx -t -q
if [ -d /run/systemd/system ]; then systemctl enable nginx >/dev/null 2>&1; systemctl reload nginx || systemctl restart nginx; fi

if [ "$UFW" = "si" ]; then
  ufw allow OpenSSH >/dev/null && ufw allow 'Nginx Full' >/dev/null && ufw --force enable >/dev/null
  echo "Firewall del sistema (ufw): abiertos 22, 80 y 443"
fi

# ---------------------------------------------------------------- 10. HTTPS
paso "9/9 HTTPS con Let's Encrypt"
URL="http://$DOMINIO"
if [ "$HTTPS" = "si" ]; then
  apt_seguro install -y -q certbot python3-certbot-nginx >/dev/null
  if [ -n "${CERTBOT_EMAIL:-}" ]; then CORREO=(-m "$CERTBOT_EMAIL"); else CORREO=(--register-unsafely-without-email); fi
  if certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos "${CORREO[@]}" --redirect --keep-until-expiring -q; then
    URL="https://$DOMINIO"
  else
    aviso "No se pudo emitir el certificado (¿puerto 80 cerrado en el firewall del proveedor?). Queda en http."
    aviso "Sin HTTPS funciona la app React, pero el admin de Django y Reservas no aceptan el login (cookies seguras)."
  fi
fi

# ---------------------------------------------------------------- verificación
sleep 2
cod() { curl -s --noproxy '*' -o /dev/null -w '%{http_code}' -H "Host: $DOMINIO" "http://127.0.0.1$1" || true; }
echo
echo "Comprobación local:  /  -> $(cod /)   /login -> $(cod /login)   /api/me/ -> $(cod /api/me/) (401 = API viva)   /admin/login/ -> $(cod /admin/login/)"
echo
echo "=================================================================="
echo " GestAntonia publicado en:  $URL"
echo " Crear el primer administrador (una sola vez):"
echo "   sudo -u $USUARIO $VENV/bin/python $APP/manage.py createsuperuser"
echo " Ver registros del backend:   sudo journalctl -u gestantonia -f"
echo " Actualizar tras un push:     sudo bash $0"
echo "=================================================================="
