## Scripts

Utility scripts for local development workflows.

### Current script

- `local-start.ts` - starts the full local environment, including the Docker backend and the web dev server
- `api-venv.ts` - manages the backend project-local Python environment in `apps/api/.venv`

### `local-start.ts`

This script:

- verifies Docker is available
- reuses an already-running frontend on `http://localhost:3000` when it matches this app
- builds missing Docker images when needed
- starts the Compose stack
- starts `bun run dev` in `apps/web` when no frontend is already running
- polls backend health and prints a readiness summary
- shuts down frontend and Docker services cleanly on exit

### Usage

From the repo root:

```bash
bun run local:start
```

### Notes

- The script reads `infra/docker/compose.env` directly for its runtime settings.
- It expects the Docker Compose file at `infra/docker/docker-compose.yml`.
- If port `3000` is already in use by something other than this app, the script exits with a clear error instead of trying to guess.

### Performance smoke (`scripts/perf/`)

- `perf/k6-api-smoke.js` — optional [k6](https://k6.io/) script for `GET /health`, `GET /chats`, and optional `POST /chats/{id}/completions` when `SESSION_ID` is set. Run from repo root, for example:

```bash
k6 run -e BASE_URL=http://localhost:8000/api/v1 scripts/perf/k6-api-smoke.js
```

### `api-venv.ts`

This script keeps backend Python dependencies inside the repository instead of on the host machine.

Supported commands:

- `setup` - create `apps/api/.venv` and install backend dependencies
- `pytest` - run backend tests through the venv
- `ruff` - run backend lint checks through the venv
- `black` - run backend formatting through the venv
- `alembic` - run Alembic commands through the venv
- `seed` - run the backend seed script through the venv
- `uvicorn` - run the API dev server through the venv

Usage:

```bash
bun run scripts/api-venv.ts setup
bun run scripts/api-venv.ts pytest
```
