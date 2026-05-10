import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const repoRoot = process.cwd()
const apiRoot = resolve(repoRoot, 'apps/api')
const venvRoot = resolve(apiRoot, '.venv')
const isWindows = process.platform === 'win32'
const venvPython = isWindows
  ? resolve(venvRoot, 'Scripts/python.exe')
  : resolve(venvRoot, 'bin/python')

const command = process.argv[2]
const args = process.argv.slice(3)

if (!command) {
  fail(
    'Usage: bun run scripts/api-venv.ts <setup|pytest|ruff|black|alembic|seed|uvicorn|pip-audit> [args...]',
  )
}

switch (command) {
  case 'setup':
    setupVenv()
    break
  case 'pytest':
    runVenvPython(['-m', 'pytest', ...args], apiRoot)
    break
  case 'ruff':
    runVenvPython(['-m', 'ruff', 'check', 'apps/api', ...args], repoRoot)
    break
  case 'black':
    runVenvPython(['-m', 'black', 'apps/api', ...args], repoRoot)
    break
  case 'alembic':
    runVenvPython(['-m', 'alembic', ...args], apiRoot)
    break
  case 'seed':
    runVenvPython(['-m', 'app.scripts.seed_dev', ...args], apiRoot)
    break
  case 'uvicorn':
    runVenvPython(['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '0.0.0.0', '--port', '8000', ...args], apiRoot)
    break
  case 'pip-audit':
    runVenvPython(['-m', 'pip_audit', ...args], apiRoot)
    break
  default:
    fail(`Unknown command: ${command}`)
}

function setupVenv() {
  const createResult = spawnSync('python', ['-m', 'venv', '.venv'], {
    cwd: apiRoot,
    stdio: 'inherit',
  })
  if (createResult.status !== 0) {
    process.exit(createResult.status ?? 1)
  }

  const installResult = spawnSync(
    venvPython,
    ['-m', 'pip', 'install', '-e', '.[dev]'],
    {
      cwd: apiRoot,
      stdio: 'inherit',
    },
  )
  if (installResult.status !== 0) {
    process.exit(installResult.status ?? 1)
  }
}

function runVenvPython(commandArgs: string[], cwd: string) {
  if (!existsSync(venvPython)) {
    fail(
      `Missing backend venv at ${venvRoot}. Run \`bun run api:setup\` first.`,
    )
  }

  const result = spawnSync(venvPython, commandArgs, {
    cwd,
    stdio: 'inherit',
  })
  process.exit(result.status ?? 1)
}

function fail(message: string): never {
  console.error(`[api-venv] ${message}`)
  process.exit(1)
}
