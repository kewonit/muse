#!/usr/bin/env bash
set -euo pipefail

APP_USER="${MUSE_APP_USER:-muse}"
APP_GROUP="${MUSE_APP_GROUP:-muse}"
APP_DIR="${MUSE_APP_DIR:-/opt/muse/backend}"
CONFIG_DIR="${MUSE_CONFIG_DIR:-/etc/muse}"
DATA_ROOT="${MUSE_DATA_ROOT:-/var/lib/muse}"
DATA_DIR="${MUSE_DATA_DIR:-${DATA_ROOT}/pb_data}"
LOG_DIR="${MUSE_LOG_DIR:-/var/log/muse}"
RELEASE_DIR="${MUSE_RELEASE_DIR:-/tmp/muse-deploy}"
SERVICE_NAME="${MUSE_SERVICE_NAME:-muse-backend}"
CADDYFILE_SOURCE="${MUSE_CADDYFILE_SOURCE:-${RELEASE_DIR}/Caddyfile}"
CADDYFILE_TARGET="${MUSE_CADDYFILE_TARGET:-/etc/caddy/Caddyfile}"

clean_env_value() {
  local value="${1:-}"
  value="${value%$'\r'}"
  value="${value#$'\ufeff'}"
  printf '%s' "${value}"
}

if [[ "${EUID}" -ne 0 ]]; then
  echo "install-release.sh must run as root" >&2
  exit 1
fi

if [[ ! -f "${RELEASE_DIR}/muse" ]]; then
  echo "missing executable release artifact: ${RELEASE_DIR}/muse" >&2
  exit 1
fi

if [[ ! -f "${RELEASE_DIR}/muse-backend.service" ]]; then
  echo "missing systemd unit: ${RELEASE_DIR}/muse-backend.service" >&2
  exit 1
fi

EXISTING_MUSE_HTTP=""
EXISTING_MUSE_ALLOWED_ORIGINS=""
REQUESTED_MUSE_HTTP="${MUSE_HTTP:-}"
REQUESTED_MUSE_ALLOWED_ORIGINS="${MUSE_ALLOWED_ORIGINS:-}"
if [[ -f "${CONFIG_DIR}/backend.env" ]]; then
  # shellcheck disable=SC1091
  source "${CONFIG_DIR}/backend.env"
  EXISTING_MUSE_HTTP="${MUSE_HTTP:-}"
  EXISTING_MUSE_ALLOWED_ORIGINS="${MUSE_ALLOWED_ORIGINS:-}"
fi

MUSE_HTTP="${REQUESTED_MUSE_HTTP:-${EXISTING_MUSE_HTTP:-127.0.0.1:8090}}"
MUSE_ALLOWED_ORIGINS="${REQUESTED_MUSE_ALLOWED_ORIGINS:-${EXISTING_MUSE_ALLOWED_ORIGINS:-https://your-frontend.example}}"
MUSE_HTTP="$(clean_env_value "${MUSE_HTTP}")"
MUSE_ALLOWED_ORIGINS="$(clean_env_value "${MUSE_ALLOWED_ORIGINS}")"

if [[ "${MUSE_ALLOWED_ORIGINS}" == "*" ]]; then
  echo "Refusing to deploy with wildcard MUSE_ALLOWED_ORIGINS=*" >&2
  exit 1
fi

if ! getent group "${APP_GROUP}" >/dev/null; then
  groupadd --system "${APP_GROUP}"
fi

if ! id "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --gid "${APP_GROUP}" --home-dir "${DATA_ROOT}" --shell /usr/sbin/nologin "${APP_USER}"
fi

install -d -m 0755 -o root -g root "${APP_DIR}" "${CONFIG_DIR}"
install -d -m 0750 -o "${APP_USER}" -g "${APP_GROUP}" "${DATA_ROOT}" "${DATA_DIR}" "${LOG_DIR}"
install -m 0755 -o root -g root "${RELEASE_DIR}/muse" "${APP_DIR}/muse"
install -m 0644 -o root -g root "${RELEASE_DIR}/muse-backend.service" "/etc/systemd/system/${SERVICE_NAME}.service"

umask 077
cat > "${CONFIG_DIR}/backend.env.tmp" <<ENV
MUSE_HTTP=${MUSE_HTTP}
MUSE_ALLOWED_ORIGINS=${MUSE_ALLOWED_ORIGINS}
ENV
mv "${CONFIG_DIR}/backend.env.tmp" "${CONFIG_DIR}/backend.env"
chown root:root "${CONFIG_DIR}/backend.env"
chmod 0600 "${CONFIG_DIR}/backend.env"

systemctl daemon-reload

if systemctl is-active --quiet "${SERVICE_NAME}"; then
  systemctl stop "${SERVICE_NAME}"
fi

if [[ -n "${PB_ADMIN_EMAIL:-}" || -n "${PB_ADMIN_PASSWORD:-}" ]]; then
  PB_ADMIN_EMAIL="$(clean_env_value "${PB_ADMIN_EMAIL}")"
  PB_ADMIN_PASSWORD="$(clean_env_value "${PB_ADMIN_PASSWORD}")"
  if [[ -z "${PB_ADMIN_EMAIL:-}" || -z "${PB_ADMIN_PASSWORD:-}" ]]; then
    echo "PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD must be set together" >&2
    exit 1
  fi
  if [[ "${#PB_ADMIN_PASSWORD}" -lt 16 ]]; then
    echo "PB_ADMIN_PASSWORD must be at least 16 characters" >&2
    exit 1
  fi
  runuser -u "${APP_USER}" -- "${APP_DIR}/muse" superuser upsert "${PB_ADMIN_EMAIL}" "${PB_ADMIN_PASSWORD}" --dir="${DATA_DIR}"
fi

systemctl enable --now "${SERVICE_NAME}"
systemctl --no-pager --full status "${SERVICE_NAME}"

if [[ -f "${CADDYFILE_SOURCE}" ]]; then
  if command -v caddy >/dev/null 2>&1; then
    install -d -m 0755 -o root -g root "$(dirname "${CADDYFILE_TARGET}")"
    install -m 0644 -o root -g root "${CADDYFILE_SOURCE}" "${CADDYFILE_TARGET}"
    caddy validate --config "${CADDYFILE_TARGET}"
    systemctl enable caddy >/dev/null
    systemctl reload caddy || systemctl restart caddy
  else
    echo "Caddy is not installed; skipped reverse proxy config install." >&2
  fi
fi
