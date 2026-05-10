## Docker Runtime

This folder contains the local Compose stack used by the project.
It starts the API, Ollama, PostgreSQL with `pgvector`, MinIO, and one-shot model import services.

### Files

- `docker-compose.yml` - full local stack definition
- `compose.env` - runtime configuration used by Compose and the startup script
- `compose.env.example` - template copy of the Compose environment
- `api/Dockerfile` - API container image

### Services

- `ollama` - shared model server
- `postgres` - persistence with `pgvector`
- `minio` - object storage for uploaded images
- `api` - FastAPI backend
- `ollama-model-qwen35-2b` - one-shot model pull job
- `ollama-model-gemma4-e2b` - one-shot model pull job
- `ollama-model-gemma4-e2b-uncensored` - optional custom GGUF import job (profile: `uncensored`)

### Runtime behavior

- The Ollama container uses a persisted `ollama-data` volume so models stay cached between runs.
- Model import jobs exit after the model is available. They are not long-running services.
- The API waits on PostgreSQL, Ollama, MinIO, and the model import jobs before serving traffic.
- Docker DNS is set explicitly through `DOCKER_DNS_PRIMARY` and `DOCKER_DNS_SECONDARY` to avoid registry and name-resolution problems on Docker Desktop.

### Start local stack

From the repo root:

```bash
bun run local:start
```

Or directly with Compose:

```bash
docker compose --env-file infra/docker/compose.env -f infra/docker/docker-compose.yml up --build
```

### Security notes (local use)

- Published ports in `docker-compose.yml` bind to all interfaces by default (e.g. `11434:11434`). On a shared network or multi-user machine, prefer **localhost-only** publishes so services are not reachable from other hosts, for example `127.0.0.1:${API_PORT:-8000}:8000` (and the same pattern for Postgres, Ollama, and MinIO ports). Adjust or duplicate the Compose file rather than relying on defaults when exposure matters.
- Replace example passwords and keys from `compose.env.example` in any non-throwaway environment; keep MinIO root credentials and `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` consistent for the API.
- Set `HEALTH_DETAILED=false` in the API environment when you want `GET /health` to omit internal URLs and bucket names (see `apps/api/README.md`).

### Notes

- **MinIO credentials:** Set `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` in `compose.env` (see `compose.env.example`). The `minio` and `api` services read these variables; rotate them together and keep `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` aligned with what the API uses to reach MinIO.
- Custom GGUF builds live under `infra/model/` and are referenced from the Compose model services.
- If Ollama cannot reach the registry on first boot, the model jobs retry and the downloaded models remain cached in `ollama-data` once pulled successfully.
