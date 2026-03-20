.PHONY: up down build logs test test-backend test-frontend migrate migrate-create seed lint format clean

up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build

logs:
	docker-compose logs -f

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

test-frontend:
	cd frontend && npm test

migrate:
	alembic upgrade head

migrate-create:
	@read -p "Migration message: " msg; \
	alembic revision --autogenerate -m "$$msg"

seed:
	python infrastructure/scripts/seed-superadmin.py

lint:
	ruff check packages/ services/
	cd frontend && npx eslint .

format:
	ruff format packages/ services/
	cd frontend && npx prettier --write .

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
