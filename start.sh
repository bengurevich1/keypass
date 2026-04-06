#!/bin/sh
set -e

echo "Pushing database schema..."
npx drizzle-kit push --force 2>&1 || echo "Schema push failed (may already exist)"

echo "Running seed..."
npx tsx src/db/seed.ts 2>&1 || echo "Seed skipped (may already be seeded)"

echo "Starting server..."
exec node dist/index.js
