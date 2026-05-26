#!/bin/bash
# backup-db.sh — Create a compressed PostgreSQL backup and clean up old files.
# Usage:  bash scripts/backup-db.sh
# Env:    PROD_DATABASE_URL  (required) — 生产数据库连接地址
#         BACKUP_DIR         (optional, default: backups)
#         RETENTION_DAYS     (optional, default: 30)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql.gz"

if [ -z "${PROD_DATABASE_URL:-}" ]; then
  echo "[backup] ERROR: PROD_DATABASE_URL is not set. 备份必须使用生产数据库地址。" >&2
  exit 1
fi

DATABASE_URL="$PROD_DATABASE_URL"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting backup → ${FILENAME}"
pg_dump "$DATABASE_URL" | gzip > "$FILENAME"
SIZE=$(du -sh "$FILENAME" | cut -f1)
echo "[backup] Done. File size: ${SIZE}"

echo "[backup] Removing backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime "+${RETENTION_DAYS}" -print -delete
echo "[backup] Cleanup complete."
