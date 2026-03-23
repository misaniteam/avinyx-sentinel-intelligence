#!/bin/bash
set -e

COMPOSE_FILE="docker-compose.sentry.yml"
cd "$(dirname "$0")"

echo "==> Starting Sentry dependencies (PostgreSQL + Redis)..."
docker compose -f "$COMPOSE_FILE" up -d sentry-postgres sentry-redis

echo "==> Waiting for PostgreSQL to be ready..."
until docker compose -f "$COMPOSE_FILE" exec sentry-postgres pg_isready -U sentry -d sentry 2>/dev/null; do
  sleep 2
done

echo "==> Running Sentry migrations..."
docker compose -f "$COMPOSE_FILE" run --rm sentry-web upgrade --noinput

echo "==> Creating admin user (admin@sentinel.dev / changeme123)..."
docker compose -f "$COMPOSE_FILE" run --rm sentry-web createuser \
  --email admin@sentinel.dev \
  --password changeme123 \
  --superuser \
  --no-input || echo "User may already exist, continuing..."

echo "==> Starting all Sentry services..."
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo "============================================"
echo " Sentry is running at http://localhost:9000"
echo " Login: admin@sentinel.dev / changeme123"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:9000 and log in"
echo "  2. Create a new project (Platform: Python)"
echo "  3. Copy the DSN from Settings > Client Keys"
echo "  4. Add to your .env file:"
echo "     SENTRY_DSN=http://<key>@host.docker.internal:9000/<project-id>"
echo "  5. Rebuild services: make build && make up"
