#!/usr/bin/env bash
# =============================================================================
# setup-github.sh
# 配置 GitHub 远端（HTTPS + Token 方式）并推送/拉取代码
# 在 Replit Shell 中手动执行：bash scripts/setup-github.sh
#
# 依赖：GITHUB_TOKEN 环境变量（存在 Replit Secrets 中）
# =============================================================================

set -euo pipefail

GITHUB_USER="ZhangColin"
GITHUB_REPO="opcorder"
REMOTE_URL="https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${GITHUB_REPO}.git"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "错误：GITHUB_TOKEN 未设置，请在 Replit Secrets 中添加。"
  exit 1
fi

echo "=========================================="
echo "  配置 GitHub 远端（HTTPS 方式）"
echo "=========================================="

# 添加或更新 github 远端
if git remote get-url github &>/dev/null; then
  echo "更新 github 远端地址..."
  git remote set-url github "$REMOTE_URL"
else
  echo "添加 github 远端..."
  git remote add github "$REMOTE_URL"
fi

echo "远端配置完成。"
echo ""
echo "推送代码：git push github master"
echo "拉取代码：git pull github master"
