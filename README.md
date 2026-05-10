# Local-First AI Chat Monorepo

Local-first chat application with a FastAPI backend, TanStack Start frontend, Docker-based runtime,
and shared TypeScript contracts.

Licensed under the Apache License, Version 2.0. Third-party model weights are
not included in this repository and keep their own licenses.

## Layout

- `apps/web` - TanStack Start + React frontend
- `apps/api` - FastAPI + SQLAlchemy + Alembic backend
- `infra/docker` - Docker Compose stack, API image, and runtime env files
- `infra/model` - custom Ollama GGUF import assets
- `packages/shared` - shared chat and model types used by the frontend and backend-facing API layer
- `scripts` - local workflow scripts such as `local-start.ts`
- `docs` - architecture and implementation notes
- `docs/plans` - phased hardening and improvement roadmap (task IDs, acceptance criteria)
- `LICENSE` / `NOTICE` - project license and third-party model notice entrypoint

## Maintenance and hardening

Phase 0 hotfixes from the roadmap are implemented in code (shared HTTP clients, request size limits,
one DB transaction per API request, MinIO env wiring, and web toolchain pins). See
`docs/architecture.md` for runtime notes.

Tracked improvements (correctness, architecture, CI/tooling, UX) live under `docs/plans/`:

- [docs/plans/README.md](docs/plans/README.md) — index, legends, and dependency matrix
- [docs/plans/phase-0-hotfixes.md](docs/plans/phase-0-hotfixes.md) — critical fixes
- [docs/plans/phase-1-architecture.md](docs/plans/phase-1-architecture.md) — API, web, and contract workstreams
- [docs/plans/phase-2-tooling.md](docs/plans/phase-2-tooling.md) — Husky, CI, TS/ESLint/Prettier, Compose, scripts
- [docs/plans/phase-3-polish.md](docs/plans/phase-3-polish.md) — UX and small API cleanups

## What the stack does

- Stores chat sessions and messages in PostgreSQL
- Stores embeddings in `pgvector`
- Stores uploaded images in MinIO
- Serves model responses through Ollama
- Supports `regular`, `roleplay`, and `task` conversation modes
- Keeps visible chat history separate from orchestration traces; the web app offers a scroll-stable chat layout, mobile session drawer, collapsible trace, and `localStorage`-backed panel preferences (see `apps/web/README.md`).

## Quick Start

1. Copy the environment files:

```powershell
Copy-Item infra/docker/compose.env.example infra/docker/compose.env
Copy-Item apps/web/.env.example apps/web/.env
Copy-Item apps/api/.env.example apps/api/.env
```

2. Install workspace dependencies:

```powershell
bun install
```

3. Start the full local stack:

```powershell
bun run local:start
```

This starts the Docker stack and the web dev server, then prints a readiness summary once both
frontend and backend are reachable.

4. Set up the backend project-local Python environment:

```powershell
bun run api:setup
```

## Common Commands

From the repo root:

```powershell
bun run local:start
bun run backend:start
bun run backend:build
bun run backend:stop
bun run frontend:dev
bun run frontend:test
bun run frontend:e2e
bun run frontend:lint
bun run format:check
bun run seed:dev
bun run api:setup
bun run api:test
bun run api:lint
bun run api:format
bun run api:alembic -- upgrade head
bun run api:seed
bun run api:dev
bun run codegen:openapi
```

### Ignoring local environment files

If you create local `.env` / `compose.env` files and they still show up in `git status`, verify your ignore
rules with:

```bash
git check-ignore -v infra/docker/compose.env apps/api/.env apps/web/.env
```

### Regenerating the OpenAPI types

`bun run codegen:openapi` spawns the API against a throwaway port, writes
`packages/shared/openapi.json`, and emits typed bindings to
`packages/shared/src/generated/api.ts`. Consumers should import the namespace
with `import { schemas } from '@local/shared'` for new DTOs.

CI drift check (run after codegen in automation):

```powershell
bun run codegen:openapi
git diff --exit-code packages/shared/openapi.json packages/shared/src/generated/api.ts
```

## Runtime Notes

- The API listens on `http://localhost:8000`
- The frontend listens on `http://localhost:3000`
- Ollama listens on `http://localhost:11434`
- MinIO listens on `http://localhost:9000`
- PostgreSQL listens on `localhost:5432`
- The backend Python environment lives in `apps/api/.venv`
- Docker DNS can be overridden through `DOCKER_DNS_PRIMARY` and `DOCKER_DNS_SECONDARY` in
  `infra/docker/compose.env`

The local stack uses a persistent `ollama-data` volume, so models stay cached after the first pull.
Custom GGUF models are imported into Ollama as one-shot Compose jobs and then reused from that same
volume.

Model weights are intentionally not committed. See [infra/model/README.md](infra/model/README.md)
for local download/import instructions and per-model NOTICE files.

## Model Set

The default allowlist currently includes:

- `qwen3.5:2b`
- `gemma4:e2b`
- `gemma4-e2b-uncensored-q5_k_p` (optional; create it via the `uncensored` profile)

`gemma4:e2b` is the image-capable model. The other models are text-only.

## Conversation Modes

- `regular` - direct single-model chat through `ChatService` and `OllamaClient`
- `roleplay` - orchestration-backed scene flow with a fixed cast and hidden run traces
- `task` - orchestration-backed planning/research flow with hidden run traces

## API Examples

Health:

```bash
curl http://localhost:8000/api/v1/health
```

Create a chat session:

```bash
curl -X POST http://localhost:8000/api/v1/chats \
  -H "Content-Type: application/json" \
  -d '{"title":"Scratchpad","conversation_mode":"regular"}'
```

Send a message:

```bash
curl -X POST http://localhost:8000/api/v1/chats/<SESSION_ID>/completions \
  -H "Content-Type: application/json" \
  -d '{"content":"Summarize the architecture","selected_model":"qwen3.5:2b","agent_mode":false,"image_asset_ids":[]}'
```

Upload an image:

```bash
curl -X POST http://localhost:8000/api/v1/images \
  -F "session_id=<SESSION_ID>" \
  -F "file=@./screenshot.png"
```

## Testing

- Backend tests live in [apps/api/tests](apps/api/tests)
- Frontend tests live in [apps/web/src](apps/web/src) and [apps/web/e2e](apps/web/e2e)
- Shared model contracts live in [packages/shared/src](packages/shared/src)

Recommended checks:

```powershell
bun run frontend:test
bun run frontend:e2e
bun run api:test
```

## Documentation

- [apps/api/README.md](apps/api/README.md)
- [apps/web/README.md](apps/web/README.md)
- [infra/docker/README.md](infra/docker/README.md)
- [scripts/README.md](scripts/README.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/plans/README.md](docs/plans/README.md) (hardening roadmap)

## Notes

- The backend never shells out to `ollama run`; it talks to the Ollama HTTP API.
- Regular chat remains the default path.
- Orchestration traces are stored separately from user-visible messages.
- The local startup script tolerates an already-running frontend only when it matches this app on
  port `3000`.
