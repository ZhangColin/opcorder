#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push --force
pnpm --filter @workspace/scripts exec tsx ./src/generate-schema-doc.ts
