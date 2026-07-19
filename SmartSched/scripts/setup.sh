#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
cp -n backend/.env.development backend/.env 2>/dev/null || true
cp -n frontend/.env.development frontend/.env 2>/dev/null || true
npm run setup
echo "Run postgres, then: cd backend && npx prisma migrate dev && npm run prisma:seed"
