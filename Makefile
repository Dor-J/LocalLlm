COMPOSE_FILE=infra/docker/docker-compose.yml
COMPOSE_ENV=infra/docker/compose.env

.PHONY: backend-build backend-start backend-stop migration-run seed-dev frontend-dev full-local-startup

backend-build:
	docker compose --env-file $(COMPOSE_ENV) -f $(COMPOSE_FILE) build

backend-start:
	docker compose --env-file $(COMPOSE_ENV) -f $(COMPOSE_FILE) up

backend-stop:
	docker compose --env-file $(COMPOSE_ENV) -f $(COMPOSE_FILE) down

migration-run:
	docker compose --env-file $(COMPOSE_ENV) -f $(COMPOSE_FILE) exec api alembic upgrade head

seed-dev:
	docker compose --env-file $(COMPOSE_ENV) -f $(COMPOSE_FILE) exec api python -m app.scripts.seed_dev

frontend-dev:
	bun --cwd apps/web dev

full-local-startup:
	bun run local:start
