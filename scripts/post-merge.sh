#!/bin/bash
set -e
pnpm install --frozen-lockfile
echo "No" | pnpm --filter db push
pnpm --filter @workspace/scripts exec tsx ./src/generate-schema-doc.ts
