#!/bin/bash
# backup-db.sh — Create a compressed PostgreSQL backup and clean up old files.
# Usage:  bash scripts/backup-db.sh
# Env:    DATABASE_URL  (required)
#         BACKUP_DIR    (optional, default: backups)
#         RETENTION_DAYS (optional, default: 30)

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql.gz"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[backup] ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting backup → ${FILENAME}"
pg_dump "$DATABASE_URL" | gzip > "$FILENAME"
SIZE=$(du -sh "$FILENAME" | cut -f1)
echo "[backup] Done. File size: ${SIZE}"

echo "[backup] Removing backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime "+${RETENTION_DAYS}" -print -delete
echo "[backup] Cleanup complete."
