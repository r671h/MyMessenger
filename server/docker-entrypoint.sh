#!/bin/sh
set -e

echo "Waiting for database and applying Prisma migrations..."
npx prisma migrate deploy

echo "Starting server..."
exec "$@"
