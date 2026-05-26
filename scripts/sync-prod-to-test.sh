#!/usr/bin/env bash
# =============================================================================
# sync-prod-to-test.sh
# 将生产数据库完整同步到测试数据库（覆盖式）
#
# 用法：
#   TEST_DATABASE_URL="postgresql://..." ./scripts/sync-prod-to-test.sh
#
# 或直接传参：
#   ./scripts/sync-prod-to-test.sh "postgresql://user:pass@host/dbname"
#
# 注意：此操作会【完全覆盖】测试数据库，请确认目标地址正确。
# =============================================================================

set -euo pipefail

PROD_DB="${DATABASE_URL:?请确保 DATABASE_URL 已设置为生产数据库地址}"
TEST_DB="${1:-${TEST_DATABASE_URL:-}}"

if [[ -z "$TEST_DB" ]]; then
  echo "错误：请通过参数或环境变量 TEST_DATABASE_URL 指定测试数据库地址"
  echo "示例：TEST_DATABASE_URL='postgresql://...' ./scripts/sync-prod-to-test.sh"
  exit 1
fi

echo "=========================================="
echo "  生产数据库 → 测试数据库 同步"
echo "=========================================="
echo "来源（生产）：${PROD_DB%%@*}@***"
echo "目标（测试）：${TEST_DB%%@*}@***"
echo ""
read -p "确认执行同步？测试数据库数据将被完全覆盖。(y/N) " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "已取消。"
  exit 0
fi

TIMESTAMP=$(date +%Y%m%dT%H%M%S)
DUMP_FILE="/tmp/prod_dump_${TIMESTAMP}.sql"

echo ""
echo "1/3 正在导出生产数据库..."
pg_dump \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  "$PROD_DB" \
  -f "$DUMP_FILE"

echo "2/3 导出完成，文件大小：$(du -sh "$DUMP_FILE" | cut -f1)"

echo "3/3 正在导入到测试数据库..."
psql "$TEST_DB" -f "$DUMP_FILE" -q

rm -f "$DUMP_FILE"

echo ""
echo "同步完成！$(date '+%Y-%m-%d %H:%M:%S')"
echo "测试数据库现在与生产数据库结构和数据一致。"
