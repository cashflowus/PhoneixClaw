.PHONY: help install dev-install lint test test-cov infra-up infra-down infra-logs \
       db-init db-migrate run-gateway run-auth run-dashboard \
       docker-build docker-up docker-down docker-logs clean benchmark

PYTHON := python3
PIP := pip3

# ─────────────────────────────────────────────
# Help
# ─────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────
install: ## Install production dependencies
	$(PIP) install -e .

dev-install: ## Install all dependencies (prod + dev)
	$(PIP) install -e ".[dev]"

env-file: ## Create .env from .env.example
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		$(PYTHON) -c "from cryptography.fernet import Fernet; print('CREDENTIAL_ENCRYPTION_KEY=' + Fernet.generate_key().decode())" >> .env; \
		echo ".env created -- edit it with your keys"; \
	else \
		echo ".env already exists"; \
	fi

dashboard-install: ## Install dashboard (npm) dependencies
	cd services/dashboard-ui && npm install

# ─────────────────────────────────────────────
# Code Quality
# ─────────────────────────────────────────────
lint: ## Run ruff linter
	$(PYTHON) -m ruff check shared/ services/ tests/

lint-fix: ## Auto-fix lint issues
	$(PYTHON) -m ruff check --fix shared/ services/ tests/

typecheck: ## Run mypy type checker
	$(PYTHON) -m mypy shared/ --ignore-missing-imports

# ─────────────────────────────────────────────
# Testing
# ─────────────────────────────────────────────
test: ## Run all unit tests
	$(PYTHON) -m pytest tests/unit/ -v --tb=short

test-cov: ## Run tests with coverage report
	$(PYTHON) -m pytest tests/unit/ --cov=shared --cov-report=term-missing --cov-report=html

benchmark: ## Run latency benchmark
	$(PYTHON) -m tests.benchmark.run_benchmark --count 1000

# ─────────────────────────────────────────────
# Local Infrastructure (Docker Compose)
# ─────────────────────────────────────────────
infra-up: ## Start Kafka, Postgres, Redis (dev mode)
	docker compose -f docker-compose.dev.yml up -d
	@echo "Waiting for services to be healthy..."
	@sleep 5
	@echo "Infrastructure ready"

infra-down: ## Stop local infrastructure
	docker compose -f docker-compose.dev.yml down

infra-logs: ## Tail infrastructure logs
	docker compose -f docker-compose.dev.yml logs -f

# ─────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────
db-init: ## Create all database tables
	$(PYTHON) -c "import asyncio; from shared.models.database import init_db; asyncio.run(init_db())"

db-migrate: ## Generate a new Alembic migration (usage: make db-migrate msg="add xyz")
	alembic revision --autogenerate -m "$(msg)"

db-upgrade: ## Apply pending migrations
	alembic upgrade head

# ─────────────────────────────────────────────
# Run Individual Services (local, no Docker)
# ─────────────────────────────────────────────
run-gateway: ## Run API Gateway on :8011
	$(PYTHON) services/api-gateway/main.py

run-auth: ## Run Auth Service on :8001
	$(PYTHON) services/auth-service/main.py

run-parser: ## Run Trade Parser on :8006
	$(PYTHON) services/trade-parser/main.py

run-executor: ## Run Trade Executor on :8008
	$(PYTHON) services/trade-executor/main.py

run-monitor: ## Run Position Monitor on :8009
	$(PYTHON) services/position-monitor/main.py

run-dashboard: ## Run React dashboard dev server on :3000
	cd services/dashboard-ui && npm run dev

# ─────────────────────────────────────────────
# Full Docker Stack
# ─────────────────────────────────────────────
docker-build: ## Build all Docker images
	docker compose build

docker-up: ## Start entire platform in Docker
	docker compose up -d

docker-down: ## Stop entire platform
	docker compose down

docker-logs: ## Tail all service logs
	docker compose logs -f

# ─────────────────────────────────────────────
# Housekeeping
# ─────────────────────────────────────────────
clean: ## Remove build artifacts and caches
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	rm -rf .pytest_cache .mypy_cache .ruff_cache htmlcov
	rm -rf *.egg-info build dist
	rm -f test.db coverage.xml .coverage
