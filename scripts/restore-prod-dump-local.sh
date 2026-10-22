#!/usr/bin/env bash
# Replaces only jiedanba_local in the local Docker DB, after backing it up.
# Never reads DATABASE_URL or connects to RDS.
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL="$ROOT/local-dev"
DUMP="${1:-$LOCAL/prod.dump}"
[[ $# -le 1 ]] || { echo '用法：bash scripts/restore-prod-dump-local.sh [备份文件路径]' >&2; exit 1; }
[[ -f "$DUMP" && -r "$DUMP" && -s "$DUMP" ]] || {
  echo '找不到可读取且非空的备份文件。默认位置是local-dev/prod.dump。' >&2; exit 1;
}
for file in compose.yaml .env api.env; do
  [[ -f "$LOCAL/$file" ]] || { echo "缺少local-dev/${file}，请先完成本地环境配置。" >&2; exit 1; }
done

# Refuse remote Docker endpoints even if the terminal has a production context.
if [[ -n "${DOCKER_CONTEXT:-}" ]]; then
  ENDPOINT="$(docker context inspect "$DOCKER_CONTEXT" --format '{{.Endpoints.docker.Host}}')"
elif [[ -n "${DOCKER_HOST:-}" ]]; then
  ENDPOINT="$DOCKER_HOST"
else
  CONTEXT="$(docker context show)"
  ENDPOINT="$(docker context inspect "$CONTEXT" --format '{{.Endpoints.docker.Host}}')"
fi
case "$ENDPOINT" in
  unix://*|npipe://*) ;;
  *) echo '拒绝执行：请切换回本机Docker Desktop/本地Unix socket，不能使用远程Docker。' >&2; exit 1 ;;
esac

dc() {
  docker compose -p jiedanba-local -f "$LOCAL/compose.yaml" --env-file "$LOCAL/.env" "$@"
}
dbsql() {
  dc exec -T db sh -c \
    'exec psql -X -v ON_ERROR_STOP=1 -P pager=off -U "$POSTGRES_USER" -d postgres -Atqc "$1"' sh "$1"
}
dc config --quiet
CID="$(dc ps -q db)"
[[ -n "$CID" ]] || { echo '本地db容器未运行，请先完成步骤07。' >&2; exit 1; }
PROJECT="$(docker inspect "$CID" --format '{{index .Config.Labels "com.docker.compose.project"}}')"
[[ "$PROJECT" == jiedanba-local ]] || { echo '容器不属于jiedanba-local，停止。' >&2; exit 1; }

STAMP="$(date +%Y%m%d_%H%M%S)_$$"
REPORT="$LOCAL/restore-reports/$STAMP"
mkdir -p "$REPORT"
chmod 700 "$REPORT"
TARGET="jiedanba_local"
trap 'echo "操作失败，应用保持停止。若已重建jiedanba_local，原数据需从报告目录的before-jiedanba_local.dump恢复；请查看报告：${REPORT}" >&2' ERR

echo '[1/6] 检查备份格式和数据库版本'
if ! dc exec -T db pg_restore --list < "$DUMP" > "$REPORT/archive.list" 2> "$REPORT/preflight.log"; then
  echo "备份无法被本地pg_restore读取。检查格式/版本，详见：$REPORT/preflight.log" >&2
  echo '不要改用psql直接执行未知SQL，不要忽略错误继续恢复。' >&2
  exit 1
fi
SOURCE_MAJOR="$(sed -n 's/^;[[:space:]]*Dumped from database version: \([0-9][0-9]*\).*/\1/p' "$REPORT/archive.list" | head -n 1)"
SERVER_VERSION="$(dbsql 'SHOW server_version_num')"
[[ "$SOURCE_MAJOR" =~ ^[0-9]+$ && "$SERVER_VERSION" =~ ^[0-9]+$ ]] || {
  echo '无法确认源/目标PostgreSQL版本，停止。请人工核对archive.list。' >&2; exit 1;
}
SERVER_MAJOR=$((SERVER_VERSION / 10000))
(( SOURCE_MAJOR <= SERVER_MAJOR )) || {
  echo "源库主版本${SOURCE_MAJOR}高于本地${SERVER_MAJOR}，不支持直接降级恢复。" >&2; exit 1;
}
# Explicit braces avoid ambiguous variable boundaries next to UTF-8 text.
echo "源库主版本：${SOURCE_MAJOR}；本地库主版本：${SERVER_MAJOR}。扩展兼容性仍须核对。"
echo "固定恢复目标：$TARGET"
echo '将先备份再覆盖jiedanba_local的全部数据；其他数据库不改动。恢复后不自动运行API。'
echo 'dump可能包含生产个人数据、令牌和配置，仅使用你有权处理的可信备份。'
read -r -p '确认暂停本地应用并覆盖jiedanba_local？输入 RESTORE_LOCAL：' CONFIRM
[[ "$CONFIRM" == RESTORE_LOCAL ]] || { echo '已取消，未停止应用、未创建数据库。'; exit 1; }

echo '[2/6] 暂停本地应用，备份默认本地库（若存在）'
dc stop dev nginx
if [[ "$(dbsql "SELECT count(*) FROM pg_database WHERE datname = 'jiedanba_local'")" == 1 ]]; then
  dc exec -T db sh -c \
    'exec pg_dump -U "$POSTGRES_USER" -d jiedanba_local -Fc --no-owner --no-acl' \
    > "$REPORT/before-jiedanba_local.dump" 2> "$REPORT/backup.log"
  dc exec -T db pg_restore --list < "$REPORT/before-jiedanba_local.dump" > /dev/null
fi

echo '[3/6] 重建jiedanba_local并完整恢复；任何SQL错误立即失败'
dc exec -T db sh -c \
  'exec dropdb -U "$POSTGRES_USER" --if-exists --force "$1"' sh "$TARGET"
dc exec -T db sh -c \
  'exec createdb -U "$POSTGRES_USER" -T template0 "$1"' sh "$TARGET"
dc exec -T db sh -c \
  'exec pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --no-privileges --exit-on-error --single-transaction' \
  sh "$TARGET" < "$DUMP" > "$REPORT/restore.log" 2>&1

echo '[4/6] 检查已恢复表，生成逐表计数（仅本地报告）'
TABLES="$(dbsql "SELECT count(*) FROM pg_database WHERE datname = '$TARGET'")"
[[ "$TABLES" == 1 ]]
dc exec -T db sh -c \
  'exec psql -X -v ON_ERROR_STOP=1 -P pager=off -U "$POSTGRES_USER" -d "$1"' \
  sh "$TARGET" > "$REPORT/checks.txt" 2>&1 <<'SQL'
SELECT current_database(), version();
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')) THEN
    RAISE EXCEPTION 'No application tables restored';
  END IF;
END $$;
SELECT format('SELECT %L AS table_name, count(*) AS rows FROM %I.%I;',
              schemaname || '.' || tablename, schemaname, tablename)
FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename
\gexec
SELECT schemaname, sequencename, last_value FROM pg_sequences
WHERE schemaname NOT IN ('pg_catalog','information_schema');
SELECT extname, extversion FROM pg_extension ORDER BY extname;
ANALYZE;
SQL

echo '[5/6] 恢复成功，jiedanba_local已更新；api.env未修改'
printf '%s\n' "$TARGET" > "$REPORT/database-name.txt"
echo "本地数据库：$TARGET"
echo "报告目录：$REPORT"
echo '[6/6] 数据库名固定为jiedanba_local，无需每次修改配置。按手册重启前后端即可。'
echo '注意：dev容器已停止，exec不会自动启动它。先在local-dev执行：'
echo 'docker compose --env-file .env up -d --force-recreate dev'
echo '然后按恢复文档第4节，在两个终端分别启动API和前端；不要重跑空库初始化。'
echo '若之前曾改为jiedanba_restore_*，只需把api.env中的数据库名改回jiedanba_local一次。'
echo 'prod.dump不含对象存储文件；恢复数据库不代表附件、支付、短信、签章等已可安全测试。'
