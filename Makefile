.PHONY: up down build logs up-prod down-prod build-prod logs-prod test test-backend test-frontend migrate migrate-create seed lint format clean sentry-setup sentry-up sentry-down sentry-logs

COMPOSE_PROD := docker compose -f docker-compose.yml -f docker-compose.prod.yml

# Development (uses docker-compose.override.yml automatically)
up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

# Production
up-prod:
	$(COMPOSE_PROD) up -d

down-prod:
	$(COMPOSE_PROD) down

build-prod:
	$(COMPOSE_PROD) build

logs-prod:
	$(COMPOSE_PROD) logs -f

test: test-backend test-frontend

test-backend:
	cd packages/shared && pytest
	cd services/api-gateway && pytest
	cd services/auth-service && pytest
	cd services/tenant-service && pytest
	cd services/ingestion-service && pytest
	cd services/ai-pipeline-service && pytest
	cd services/analytics-service && pytest
	cd services/campaign-service && pytest
	cd services/notification-service && pytest
	cd services/logging-service && pytest

test-frontend:
	cd frontend && npm test

migrate:
	docker compose exec -e DATABASE_URL_SYNC=postgresql://sentinel:sentinel@postgres:5432/sentinel auth-service alembic -c /app/alembic.ini upgrade head

migrate-create:
	@read -p "Migration message: " msg; \
	docker compose exec -e DATABASE_URL_SYNC=postgresql://sentinel:sentinel@postgres:5432/sentinel auth-service alembic -c /app/alembic.ini revision --autogenerate -m "$$msg"

seed: migrate
	docker compose exec -e DATABASE_URL=postgresql+asyncpg://sentinel:sentinel@postgres:5432/sentinel auth-service python /app/infrastructure/scripts/seed-superadmin.py

lint:
	ruff check packages/ services/
	cd frontend && npx eslint .

format:
	ruff format packages/ services/
	cd frontend && npx prettier --write .

# Sentry (optional, resource-heavy — uses Docker Compose profiles)
sentry-setup:
	@echo "Ensuring postgres and redis are running..."
	docker compose up -d postgres redis
	@until docker compose exec postgres pg_isready -U sentinel 2>/dev/null; do sleep 2; done
	docker compose exec postgres psql -U sentinel -tc "SELECT 1 FROM pg_database WHERE datname = 'sentry'" | grep -q 1 || \
		docker compose exec postgres psql -U sentinel -c "CREATE DATABASE sentry"
	docker compose --profile sentry run --rm sentry-web upgrade --noinput
	docker compose --profile sentry run --rm sentry-web createuser \
		--email admin@sentinel.dev --password changeme123 --superuser --no-input || echo "User may already exist"
	@echo ""
	@echo "Sentry initialized. Run 'make sentry-up' to start."
	@echo "Then open http://localhost:9000, create a Python project, and copy the DSN to .env"

sentry-up:
	docker compose --profile sentry up -d

sentry-down:
	docker compose --profile sentry down

sentry-logs:
	docker compose --profile sentry logs -f sentry-web sentry-worker sentry-cron

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .next -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name dist -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name htmlcov -exec rm -rf {} + 2>/dev/null || true
	find . -name .coverage -delete 2>/dev/null || true
