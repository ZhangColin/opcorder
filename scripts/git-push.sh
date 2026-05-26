#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "错误：GITHUB_TOKEN 未设置"
  exit 1
fi

REMOTE="https://ZhangColin:${GITHUB_TOKEN}@github.com/ZhangColin/opcorder.git"

git push "$REMOTE" master
