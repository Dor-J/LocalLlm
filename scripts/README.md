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
- on Windows, opens separate terminal windows for the backend stack and frontend dev server
- on other platforms, starts the Compose stack and web dev server in the current terminal
- on other platforms, polls backend health and shuts down frontend and Docker services cleanly on exit

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
- `pip-audit` - scan the venv for packages with known vulnerabilities (requires `bun run api:setup` so `pip-audit` is installed)

Usage:

```bash
bun run scripts/api-venv.ts setup
bun run scripts/api-venv.ts pytest
bun run scripts/api-venv.ts pip-audit
```

### Supply-chain audits

From the repo root after `bun run api:setup`:

- **Backend:** `bun run security:audit:api` (same as `bun run scripts/api-venv.ts pip-audit`).
- **Web app:** `bun run security:audit:web` (runs `bun audit` in `apps/web`).
