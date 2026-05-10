import { readFileSync, writeFileSync } from 'node:fs'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const composeArgs = [
  'compose',
  '--env-file',
  'infra/docker/compose.env',
  '-f',
  'infra/docker/docker-compose.yml',
]
const composeEnv = readSimpleEnvFile('infra/docker/compose.env')
const composeProjectName = composeEnv.COMPOSE_PROJECT_NAME ?? 'localfirstchat'
const frontendPort = '3000'
const frontendOrigin = `http://localhost:${frontendPort}`
const apiPort = composeEnv.API_PORT ?? '8000'
const backendOrigin = `http://localhost:${apiPort}`
const backendApiUrl = `${backendOrigin}/api/v1`
const backendHealthUrl = `${backendApiUrl}/health`

assertDockerAvailable()
const existingFrontend = await detectExistingFrontend(frontendOrigin)
ensureRequiredImages()

if (process.platform === 'win32') {
  launchWindowsTerminals(existingFrontend)
  await Bun.sleep(100)
  process.exit(0)
}

let shuttingDown = false
let frontendReady = Boolean(existingFrontend)
let backendReady = false
let summaryPrinted = false
let frontendUrl: string | null = existingFrontend ? frontendOrigin : null

const backend = spawn('docker', [...composeArgs, 'up'], {
  cwd: process.cwd(),
  stdio: ['inherit', 'pipe', 'pipe'],
})
const web = existingFrontend
  ? null
  : spawn('bun', ['--cwd', 'apps/web', 'dev'], {
      cwd: process.cwd(),
      stdio: ['inherit', 'pipe', 'pipe'],
    })

pipeLogs('backend', backend)
if (web) {
  pipeLogs('web', web)
} else {
  console.log(`[local] reusing existing frontend at ${frontendOrigin}`)
}

printSummary()

void monitorBackendHealth()

backend.on('exit', (code) => {
  if (!shuttingDown) {
    console.error(`[backend] exited with code ${code ?? 0}`)
    void shutdown(code ?? 1)
  }
})

if (web) {
  web.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`[web] exited with code ${code ?? 0}`)
      void shutdown(code ?? 1)
    }
  })
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void shutdown(0)
  })
}

function pipeLogs(label: string, child: ChildProcess) {
  for (const stream of [child.stdout, child.stderr]) {
    if (!stream) {
      continue
    }

    const reader = createInterface({ input: stream })
    reader.on('line', (line) => {
      console.log(`[${label}] ${line}`)

      if (label === 'web') {
        const matchedLocalUrl = line.match(/Local:\s+(https?:\/\/\S+)/)
        if (matchedLocalUrl?.[1]) {
          frontendUrl = matchedLocalUrl[1].replace(/\/$/, '')
          frontendReady = true
          printSummary()
        }
      }

      if (label === 'web' && line.includes('Port 3000 is already in use')) {
        console.error('[local] frontend port 3000 is already in use')
      }
    })
  }
}

async function monitorBackendHealth() {
  while (!shuttingDown && !backendReady) {
    try {
      const response = await fetch(backendHealthUrl)
      if (response.ok) {
        backendReady = true
        printSummary()
        return
      }
    } catch {
      // Backend is still starting.
    }

    await Bun.sleep(1000)
  }
}

function printSummary() {
  if (summaryPrinted || !backendReady || !frontendReady) {
    return
  }

  summaryPrinted = true
  console.log(
    `[local] ready frontend=${frontendUrl} backend=${backendOrigin} api=${backendApiUrl} health=${backendHealthUrl}`,
  )
}

async function shutdown(exitCode: number) {
  if (shuttingDown) {
    return
  }
  shuttingDown = true

  console.log('[local] shutting down frontend and Docker services...')
  if (web) {
    terminateChild(web, 'SIGINT')
    await Bun.sleep(250)
  }

  spawnSync(
    'docker',
    [...composeArgs, 'down', '--remove-orphans', '--timeout', '10'],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
    },
  )

  if (web) {
    terminateChild(web, 'SIGTERM')
  }
  terminateChild(backend, 'SIGTERM')

  process.exit(exitCode)
}

function terminateChild(child: ChildProcess, signal: NodeJS.Signals) {
  if (child.exitCode !== null || child.killed) {
    return
  }

  child.kill(signal)
  if (process.platform !== 'win32' || !child.pid) {
    return
  }

  spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
    stdio: 'ignore',
  })
}

function launchWindowsTerminals(existingFrontend: boolean) {
  const bunCommand = resolveCommandPath('bun')

  launchWindowsTerminal('LocalLlm Backend', [
    'echo [backend] Starting Docker stack, API, databases, Ollama, and model jobs...',
    `${quoteCmdArg(bunCommand)} run backend:start`,
  ])

  if (existingFrontend) {
    console.log(`[local] reusing existing frontend at ${frontendOrigin}`)
  } else {
    launchWindowsTerminal('LocalLlm Frontend', [
      'echo [web] Starting frontend dev server...',
      `${quoteCmdArg(bunCommand)} run frontend:dev`,
    ])
  }

  console.log(
    `[local] opened backend terminal${existingFrontend ? '' : ' and frontend terminal'}`,
  )
  console.log(
    `[local] frontend=${frontendOrigin} backend=${backendOrigin} api=${backendApiUrl}`,
  )
  console.log(
    '[local] stop the backend terminal with Ctrl+C, or run `bun run backend:stop`',
  )
}

function launchWindowsTerminal(title: string, commands: string[]) {
  const commandFile = writeWindowsCommandFile(title, commands)
  launchDetached('cmd.exe', ['/c', 'start', '', commandFile])
}

function launchDetached(command: string, args: string[]) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  })
  child.unref()
}

function quoteCmdArg(value: string) {
  return `"${value.replaceAll('"', '\\"')}"`
}

function writeWindowsCommandFile(title: string, commands: string[]) {
  const filename = `localllm-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.cmd`
  const path = join(tmpdir(), filename)
  const content = [
    '@echo off',
    'chcp 65001 >nul',
    `title ${title}`,
    `cd /d ${quoteCmdArg(process.cwd())}`,
    ...commands,
    'set EXIT_CODE=%ERRORLEVEL%',
    'echo.',
    'echo [local] command exited with code %EXIT_CODE%',
    'cmd /k',
    '',
  ].join('\r\n')

  writeFileSync(path, content, 'utf8')
  return path
}

function resolveCommandPath(command: string) {
  const finder = process.platform === 'win32' ? 'where.exe' : 'which'
  const result = spawnSync(finder, [command], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'pipe',
  })

  if (result.status !== 0) {
    return command
  }

  return (
    result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? command
  )
}

function readSimpleEnvFile(path: string) {
  const content = readFileSync(path, 'utf8')
  const entries = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separatorIndex = line.indexOf('=')
      if (separatorIndex === -1) {
        return null
      }

      return [
        line.slice(0, separatorIndex).trim(),
        line.slice(separatorIndex + 1).trim(),
      ] as const
    })
    .filter((entry): entry is readonly [string, string] => entry !== null)

  return Object.fromEntries(entries)
}

function assertDockerAvailable() {
  const result = spawnSync('docker', ['info'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    encoding: 'utf8',
  })

  if (result.status === 0) {
    return
  }

  const stderr = (result.stderr ?? '').trim()
  const stdout = (result.stdout ?? '').trim()
  const details = [stderr, stdout].filter(Boolean).join('\n')
  const hint =
    process.platform === 'win32'
      ? 'Start Docker Desktop and wait until the engine is running, then re-run `bun run local:start`.'
      : 'Start the Docker daemon, then re-run `bun run local:start`.'

  console.error('[local] Docker is not available.')
  if (details) {
    console.error(details)
  }
  console.error(`[local] ${hint}`)
  process.exit(result.status ?? 1)
}

function ensureRequiredImages() {
  const requiredServices = [
    {
      service: 'api',
      image: `${composeProjectName}-api`,
    },
  ]

  const missingServices = requiredServices
    .filter(({ image }) => !dockerImageExists(image))
    .map(({ service }) => service)

  if (missingServices.length === 0) {
    return
  }

  console.log(
    `[local] building missing Docker images for: ${missingServices.join(', ')}`,
  )

  const result = spawnSync(
    'docker',
    [...composeArgs, 'build', ...missingServices],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
    },
  )

  if (result.status === 0) {
    return
  }

  console.error('[local] required Docker image build failed')
  process.exit(result.status ?? 1)
}

function dockerImageExists(image: string) {
  const result = spawnSync('docker', ['image', 'inspect', image], {
    cwd: process.cwd(),
    stdio: 'ignore',
  })
  return result.status === 0
}

async function detectExistingFrontend(origin: string) {
  try {
    const response = await fetch(origin)
    const html = await response.text()
    if (response.ok && html.includes('<title>Local-First AI Chat</title>')) {
      return true
    }
  } catch {
    return false
  }

  console.error(
    `[local] port ${frontendPort} is already in use by a different process. Stop it or free the port, then re-run bun run local:start.`,
  )
  process.exit(1)
}
