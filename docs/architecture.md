# Architecture

## Overview

This starter keeps the runtime intentionally boring:

- TanStack Start renders a local-first chat UI and talks to the API over typed REST calls.
- FastAPI owns the application logic, persistence, Ollama integration, and feature flags.
- PostgreSQL is the primary database for both operational chat data and vector storage through `pgvector`.
- MinIO handles uploaded image binaries while PostgreSQL stores the image metadata and session relationships.
- The agent orchestration layer is only an optional abstraction boundary and is not treated as the core chat runtime.
- Ollama runs as a Compose service in `infra/docker/docker-compose.yml`, and two one-shot pull workers using the same `ollama/ollama` image preload `qwen3.5:2b` and `gemma4:e2b`; optional local Docker import images can add GGUF-backed models to the same persistent named volume.
- Local startup is supervised by a small script that prints exact service URLs and performs coordinated shutdown on `Ctrl+C`.

## Monorepo structure

- `/apps/web`: TanStack Start React app, Bun-managed
- `/apps/api`: FastAPI application, SQLAlchemy models, Alembic migrations, tests
- `/infra/docker`: Compose and API Dockerfile
- `/infra/docker/compose.env`: Docker runtime configuration colocated with Compose
- `/packages/shared`: frontend-shared TypeScript contracts and model constants
- `/docs`: setup and decision records

## Frontend decisions

- TanStack Start was kept close to the current upstream example shape: file-based routes, `vite.config.ts`, a checked-in `routeTree.gen.ts`, and a single route-driven page shell.
- The UI is intentionally local/dev-first:
  - Sidebar for persisted conversations
  - Main transcript area
  - Composer with keyboard submit
  - Exact radio group for model selection
  - Gemma-only image upload affordance backed by MinIO
  - Experimental agent-mode toggle that stays disabled unless explicitly enabled
- The frontend sends the selected model on every chat completion request, and assistant messages render the model used.
- Shared TypeScript types live in `packages/shared` to keep request and response shapes explicit without introducing code generation yet.

## Backend decisions

### Application layers

- API routes: input/output validation and HTTP error mapping
- Services: chat orchestration, embeddings, vector search, Ollama provider boundary
- Repositories: SQLAlchemy persistence operations
- Models: explicit relational schema for chat sessions, messages, chunks, embeddings, and app settings

### Chat path

1. The client sends `content`, `selectedModel`, and `agentMode`.
2. `ChatService` validates the model against the allowlist.
3. If image attachments are present, `ImageAssetService` validates them against the current session and loads the image bytes from MinIO.
4. The user message is persisted first, with the image attachment IDs recorded in metadata.
5. Conversation history is loaded from PostgreSQL.
6. If agent mode is enabled and an experimental orchestrator is configured, the orchestration layer can prepend safe system instructions.
7. `OllamaClient` calls the local Ollama HTTP API, including image bytes only for `gemma4:e2b`.
8. The assistant response is persisted and returned to the client.

This keeps storage authoritative and leaves room to add streaming later without rewriting the service boundary.

### Transactions (database)

- Each mutating HTTP request runs under one SQLAlchemy transaction: `get_db_session` wraps the session in `async with session.begin()`.
- Services use `flush()` when generated keys must be visible before a later step; they do not call `commit()` directly.
- If any step fails (including the LLM call after the user message is written), the whole turn rolls back so partial chat rows are not committed.

### Storage guard

- `StorageGuardService.log_usage(context=...)` is called at every persistence boundary (user/assistant message, image upload, embedding index).
- Logging is threshold-gated by `STORAGE_USAGE_LOG_MIN_INTERVAL_SECONDS` (default 60s); within the window the call is a cheap no-op and skips the seven count queries.
- Call sites that materially change storage (image upload/delete, session-scoped image cleanup) pass `force=True` so they always emit a fresh snapshot.
- Limit enforcement (`guard_*`) is independent of `log_usage` gating.

### Ollama integration

- The backend uses HTTP calls to `/api/chat`.
- Allowed models are validated server-side.
- `OllamaClient` is behind a `ChatProvider` abstraction so another provider can be added later without changing route contracts.
- The allowlist currently exposes `qwen3.5:2b`, `gemma4:e2b`, and the optional `gemma4-e2b-uncensored-q5_k_p` (created via the Compose `uncensored` profile).
- Ollama model-tag lookups are cached with a short TTL so availability checks do not repeatedly hit Ollama during normal local use.
- MinIO is accessed through a small storage service abstraction so the object store can be swapped later without changing the chat or upload routes.

### Streaming chat completions (SSE)

- `POST /api/v1/chats/{session_id}/completions/stream` returns a Server-Sent Events stream of `meta` → `token*` → `done` (or a single `error` on failure).
- The legacy non-streaming `POST /api/v1/chats/{session_id}/completions` endpoint is retained for clients that cannot consume SSE.
- Concurrency is bounded by `OLLAMA_NUM_PARALLEL` in `infra/docker/compose.env`. The default of `1` matches the CPU-only local runtime and prevents request pile-up; raise it only when the host has GPU headroom.
- The request-scoped database transaction commits after the generator finishes, so the persisted assistant message and the terminal `done` event always move together.

## Database decisions

- PostgreSQL remains the source of truth for:
  - `chat_sessions`
  - `chat_messages`
  - `document_chunks`
  - `embedding_records`
  - `app_settings`
- `pgvector` is enabled in the initial migration.
- Embeddings are stored in PostgreSQL instead of introducing a separate vector database at this stage.
- The vector column is declared as `vector` rather than a fixed-dimension `vector(n)` so the schema can tolerate future embedding model changes more gracefully in this starter.

The current search path uses exact distance ordering with the `<=>` operator. Approximate vector indexing can be introduced later once the embedding model and dimensions are stable.

## Local Runtime And Caching

- Normal `backend:start` uses `docker compose up --build` so API dependency changes are picked up automatically.
- The API Dockerfile still uses a pip cache mount to reduce dependency download churn across rebuilds.
- The web dev server is pinned to port `3000` with `strictPort` enabled so startup failures are explicit rather than silently drifting to another port.
- The Ollama model store is persisted in the `ollama-data` Docker volume so the models are downloaded once and reused on later runs.

## Safety Limits

- Request bodies are capped before route handling.
- Chat and embedding payloads are length-limited at the schema boundary.
- Storage growth is guarded with configurable limits for sessions, per-session messages, chunks, embedding records, and database size.
- The backend logs current storage usage after write operations and emits warnings as limits approach configured thresholds, including image counts and image bytes.

## Agent orchestration boundary

The code includes:

- `AgentOrchestrationService` interface
- `NoOpAgentOrchestrator`
- `ExperimentalComposioOrchestrator`

This is deliberate. ComposioHQ / `agent-orchestrator` is a better fit for explicit coding-agent or worktree flows than for the normal in-app chat loop. The experimental adapter is therefore:

- Feature-flagged
- Non-destructive
- Kept out of the default chat path
- Exposed through a safe demo endpoint for future experimentation

That preserves a clean seam for future work without shipping fake multi-agent behavior today.

## Tradeoffs

- No auth yet: simpler local/dev startup, but session ownership is not implemented.
- No streaming UI yet: faster starter delivery, but the service and provider contracts already leave room for SSE or chunked responses.
- No local embedding model yet: the storage and search path exist, but automatic embedding generation remains a TODO.
- No background jobs or Redis: fewer moving parts, enough for a local-first starter, but heavier ingest pipelines would eventually want asynchronous job handling.

## Future Extensions

- Streaming responses
- RAG ingestion
- Local embedding model
- Composio/agent orchestration integration
- Auth/multi-user support
