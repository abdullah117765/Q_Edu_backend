#!/bin/sh
set -eu

if [ "${PRISMA_MIGRATE_DEPLOY:-true}" = "true" ]; then
  npx prisma migrate deploy
fi

exec "$@"
