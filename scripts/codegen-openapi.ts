/**
 * Regenerates the shared OpenAPI schema + TypeScript types.
 *
 * Steps:
 *   1. Spawn `uvicorn app.main:app` bound to a throwaway port.
 *   2. Poll `/openapi.json` until the app is ready (10s timeout).
 *   3. Write the JSON document to `packages/shared/openapi.json`.
 *   4. Run `openapi-typescript` to emit `packages/shared/src/generated/api.ts`.
 *   5. Tear the spawned server down.
 *
 * CI gate (deferred to Phase 2):
 *   `bun run codegen:openapi && git diff --exit-code packages/shared/openapi.json packages/shared/src/generated/api.ts`
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const repoRoot = process.cwd()
const apiRoot = resolve(repoRoot, 'apps/api')
const sharedRoot = resolve(repoRoot, 'packages/shared')
const openapiJsonPath = resolve(sharedRoot, 'openapi.json')
const generatedTsPath = resolve(sharedRoot, 'src/generated/api.ts')
const venvPython = resolveVenvPython()
const port = Number.parseInt(process.env.CODEGEN_API_PORT ?? '8765', 10)
const baseUrl = `http://127.0.0.1:${port}`

const server = startServer()
let cleanedUp = false
try {
  await pollUntilReady(`${baseUrl}/api/v1/health`, 20_000)
  const document = await fetchOpenApi(`${baseUrl}/openapi.json`)
  writeFileSafely(openapiJsonPath, `${JSON.stringify(document, null, 2)}\n`)
  runOpenApiTypescript()
  console.log('[codegen] wrote', openapiJsonPath)
  console.log('[codegen] wrote', generatedTsPath)
} finally {
  cleanedUp = true
  terminate(server)
}

function resolveVenvPython() {
  const isWindows = process.platform === 'win32'
  const candidate = isWindows
    ? resolve(apiRoot, '.venv/Scripts/python.exe')
    : resolve(apiRoot, '.venv/bin/python')

  if (!existsSync(candidate)) {
    fail(
      `API venv python not found at ${candidate}. Run 'bun run api:setup' first.`,
    )
  }
  return candidate
}

function startServer(): ChildProcess {
  console.log(`[codegen] starting API on ${baseUrl}`)
  const child = spawn(
    venvPython,
    ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: apiRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, LOG_FORMAT: 'text' },
    },
  )

  child.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(`[api] ${chunk.toString()}`)
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[api] ${chunk.toString()}`)
  })
  child.on('exit', (code) => {
    if (!cleanedUp && code !== 0) {
      fail(`API server exited early with code ${code}`)
    }
  })
  return child
}

async function pollUntilReady(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch {
      // still starting
    }
    await Bun.sleep(250)
  }
  fail(`API did not become ready at ${url} within ${timeoutMs}ms`)
}

async function fetchOpenApi(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) {
    fail(`Failed to fetch ${url}: ${response.status}`)
  }
  return (await response.json()) as unknown
}

function writeFileSafely(path: string, contents: string) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents, 'utf8')
}

function runOpenApiTypescript() {
  const result = spawnSync(
    'bun',
    ['x', 'openapi-typescript', openapiJsonPath, '-o', generatedTsPath],
    {
      cwd: repoRoot,
      stdio: 'inherit',
    },
  )
  if (result.status !== 0) {
    fail(`openapi-typescript failed with status ${result.status}`)
  }
}

function terminate(child: ChildProcess) {
  if (child.exitCode !== null || child.killed) {
    return
  }
  child.kill('SIGTERM')
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  }
}

function fail(message: string): never {
  console.error(`[codegen] ${message}`)
  process.exit(1)
}
