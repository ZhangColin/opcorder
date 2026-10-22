#!/usr/bin/env bash
# Password is read without echo and passed only via stdin, never argv/env/logs.
set -euo pipefail
set +x
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL="$ROOT/local-dev"
[[ -t 0 ]] || { echo '请在本机交互终端执行，密码不要写入命令或文件。' >&2; exit 1; }
if [[ -n "${DOCKER_CONTEXT:-}" ]]; then
  ENDPOINT="$(docker context inspect "$DOCKER_CONTEXT" --format '{{.Endpoints.docker.Host}}')"
elif [[ -n "${DOCKER_HOST:-}" ]]; then
  ENDPOINT="$DOCKER_HOST"
else
  ENDPOINT="$(docker context inspect "$(docker context show)" --format '{{.Endpoints.docker.Host}}')"
fi
case "$ENDPOINT" in
  unix://*|npipe://*) ;;
  *) echo '拒绝远程Docker；请切回本机Docker Desktop。' >&2; exit 1 ;;
esac
dc() {
  docker compose -p jiedanba-local -f "$LOCAL/compose.yaml" --env-file "$LOCAL/.env" "$@"
}
dc config --quiet
dc exec -T dev node /workspace/scripts/create-local-admin.mjs --check
echo '将仅在本地样例库创建admin@jiedanba.com，全权限管理员；不覆盖已有账号。'
read -r -p '确认创建？输入 CREATE_LOCAL_ADMIN：' CONFIRM
[[ "$CONFIRM" == CREATE_LOCAL_ADMIN ]] || { echo '已取消。'; exit 1; }
trap 'unset PASSWORD CONFIRMED_PASSWORD' EXIT
read -r -s -p '设置本地密码（至少12个字符）：' PASSWORD
printf '\n'
read -r -s -p '再次输入密码：' CONFIRMED_PASSWORD
printf '\n'
[[ "$PASSWORD" == "$CONFIRMED_PASSWORD" ]] || { echo '两次输入不一致，未创建账号。' >&2; exit 1; }
printf '%s' "$PASSWORD" | dc exec -T dev node /workspace/scripts/create-local-admin.mjs --create
