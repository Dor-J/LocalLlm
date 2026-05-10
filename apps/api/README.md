## API

FastAPI backend for the local-first chat stack. It owns chat sessions, message persistence,
image uploads, embeddings, health checks, and agent orchestration.

### What lives here

- `app/api/` - HTTP routes and router wiring
- `app/core/` - settings, logging, and time helpers
- `app/db/` - SQLAlchemy base, session factory, and custom types
- `app/models/` - ORM models for chats, images, embeddings, and orchestration traces
- `app/repositories/` - database access layer
- `app/services/` - chat runtime, Ollama client, image handling, storage, embeddings, and orchestration
- `app/middleware/` - request-size protection, request id, and request-level timing logs
- `app/schemas/` - request and response models
- `alembic/` - migrations
- `tests/` - backend service and API tests

### Runtime dependencies

The API expects the local Docker stack to provide:

- PostgreSQL with `pgvector`
- Ollama
- MinIO

The default service wiring is configured through environment variables in `apps/api/.env`.

### Main API routes

- `GET /api/v1/health`
- `GET /api/v1/chats` (paginated: `limit`, `offset`; returns `items`, `total`, `limit`, `offset`)
- `POST /api/v1/chats`
- `GET /api/v1/chats/{session_id}` (full message history for the session)
- `POST /api/v1/chats/{session_id}/completions`
- `DELETE /api/v1/chats/{session_id}`
- `GET /api/v1/chats/{session_id}/messages` (paginated: `limit`, `offset`)
- `GET /api/v1/images` (paginated: `limit`, `offset`, optional `session_id`)
- `POST /api/v1/images`
- `GET /api/v1/images/{image_asset_id}`
- `GET /api/v1/images/{image_asset_id}/content`
- `DELETE /api/v1/images/{image_asset_id}`
- `POST /api/v1/embeddings/index`
- `POST /api/v1/embeddings/search`
- `POST /api/v1/agent/dispatch-demo`

### Configuration

Key environment variables:

- `DATABASE_URL`
- `DATABASE_POOL_SIZE`, `DATABASE_MAX_OVERFLOW`, `DATABASE_POOL_RECYCLE`, `DATABASE_POOL_TIMEOUT`
- `DB_SLOW_QUERY_LOG_MS` (log SQL statements slower than this threshold at WARNING)
- `LOG_FORMAT` (`text` or `json`)
- `CORS_ORIGINS`
- `OLLAMA_BASE_URL`
- `OLLAMA_ALLOWED_MODELS`
- `OLLAMA_TIMEOUT_SECONDS`
- `MINIO_ENDPOINT`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET_NAME`
- `EXPERIMENTAL_AGENT_ORCHESTRATION_ENABLED`
- `AGENT_ORCHESTRATOR_BACKEND`
- `UVICORN_WORKERS`, `UVICORN_RELOAD` (used by local scripts / Compose overrides; production image uses workers, no reload)
- `MAX_IMAGE_LIST_PER_PAGE` (cap for `GET /images` pagination)
- `HEALTH_DETAILED` (default `true`) — when `false`, `GET /health` returns only aggregate readiness flags without endpoints, bucket names, or model lists

See `apps/api/.env.example` for the full default set.

### Security notes (localhost-oriented)

- Responses include baseline headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) via `SecurityHeadersMiddleware`.
- Client-provided `X-Request-Id` values are capped in length and restricted to URL-safe characters; invalid values are replaced with a server-generated id.
- Image uploads are validated with magic-byte sniffing; only PNG, JPEG, GIF, and WebP are accepted (SVG and mismatched `Content-Type` are rejected).
- Dependency audit: from the repo root run `bun run security:audit:api` (uses `pip-audit` in `apps/api/.venv` after `bun run api:setup`).

### Observability and performance

- Each HTTP request logs `http_request` with `duration_ms`, `db_cumulative_ms` (async SQLAlchemy cursor time), method, path, and status (see `RequestContextMiddleware`).
- Ollama HTTP calls log `ollama_request` with `ollama_http_ms` and `ollama_operation` (`list_models`, `chat`, `chat_stream`).
- PostgreSQL in Docker can log slow statements via `POSTGRES_LOG_MIN_DURATION_MS` in `infra/docker/compose.env` (wired into the `postgres` service `command`).
- Optional load smoke: `scripts/perf/k6-api-smoke.js` (requires [k6](https://k6.io/)).

### CORS policy

The API enumerates allowed methods and headers explicitly:

- **methods**: `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`
- **request headers**: `Content-Type`, `Authorization`, `X-Request-Id`
- **exposed response headers**: `X-Request-Id`

### Local development

The backend uses a project-local virtual environment at `apps/api/.venv`.
Set it up from the repo root:

```bash
bun run api:setup
```

From the repo root:

```bash
bun run api:alembic -- upgrade head
bun run api:dev
```

Common checks:

```bash
bun run api:test
bun run api:lint
bun run security:audit:api
```

### Notes

- The regular chat path still uses `ChatService` plus `OllamaClient`.
- Roleplay and task modes use the orchestration boundary, but visible chat messages remain in the normal chat tables.
- Orchestration traces are stored separately in `orchestration_runs` and `orchestration_steps`.
