#!/usr/bin/env bash
# =============================================================================
# setup-github.sh
# 一次性配置 GitHub 远端并推送代码
# 在 Replit Shell 中手动执行：bash scripts/setup-github.sh
# =============================================================================

set -euo pipefail

GITHUB_REPO="git@github.com:ZhangColin/opcorder.git"

echo "=========================================="
echo "  配置 GitHub 远端并推送代码"
echo "=========================================="

# 检查 SSH 密钥
if [[ ! -f ~/.ssh/id_ed25519 ]]; then
  echo "错误：未找到 SSH 密钥，请先运行 ssh-keygen 生成密钥"
  exit 1
fi

# 确保 known_hosts 包含 GitHub
ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts 2>/dev/null

# 添加或更新 github 远端
if git remote get-url github &>/dev/null; then
  echo "更新 github 远端地址..."
  git remote set-url github "$GITHUB_REPO"
else
  echo "添加 github 远端..."
  git remote add github "$GITHUB_REPO"
fi

echo ""
echo "当前远端列表："
git remote -v | grep github

echo ""
echo "测试 GitHub SSH 连接..."
ssh -T git@github.com 2>&1 || true

echo ""
echo "推送代码到 GitHub (master 分支)..."
git push github master

echo ""
echo "推送完成！代码已同步到 GitHub。"
echo "仓库地址：https://github.com/ZhangColin/opcorder"
