import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'

type MockRouteHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => void

const mockApiPort = 8001

function apiPath(url: string) {
  const q = url.indexOf('?')
  return q === -1 ? url : url.slice(0, q)
}

function emptyChatListPage() {
  return { items: [], total: 0, limit: 500, offset: 0 }
}

test('chat page sends a message and renders the mocked assistant response', async ({
  page,
}) => {
  const session = {
    id: 'session-1',
    title: 'Mock session',
    conversationMode: 'regular',
    crewTemplateId: null,
    sceneState: {},
    createdAt: '2026-04-17T00:00:00.000Z',
    updatedAt: '2026-04-17T00:00:00.000Z',
  }
  const imageAsset = {
    id: 'image-1',
    sessionId: session.id,
    fileName: 'screenshot.png',
    contentType: 'image/png',
    byteSize: 12,
    sha256: 'abc123',
    contentUrl: `http://127.0.0.1:${mockApiPort}/api/v1/images/image-1/content`,
    metadata: {},
    createdAt: '2026-04-17T00:00:00.000Z',
  }

  await withMockApi(
    async (request, response) => {
      const url = request.url ?? ''
      const method = request.method ?? 'GET'

      if (url === '/api/v1/health' && method === 'GET') {
        sendJson(response, 200, {
          status: 'ok',
          appName: 'local-first-ai-chat-api',
          allowedModels: [
            'qwen3.5:2b',
            'gemma4:e2b',
            'gemma4-e2b-uncensored-q5_k_p',
          ],
          agentOrchestrationEnabled: false,
          ollama: {
            ready: true,
            baseUrl: 'http://host.docker.internal:11434',
            availableModels: [
              'qwen3.5:2b',
              'gemma4:e2b',
              'gemma4-e2b-uncensored-q5_k_p',
            ],
            missingAllowedModels: [],
            error: null,
          },
          timestamp: '2026-04-17T00:00:00.000Z',
        })
        return
      }

      if (apiPath(url) === '/api/v1/chats' && method === 'GET') {
        sendJson(response, 200, emptyChatListPage())
        return
      }

      if (url === '/api/v1/chats' && method === 'POST') {
        const body = await readJsonBody(request)
        expect(body.conversationMode).toBe('regular')
        expect(body.crewTemplateId).toBeNull()
        sendJson(response, 201, { session })
        return
      }

      if (url === '/api/v1/images' && method === 'POST') {
        sendJson(response, 201, imageAsset)
        return
      }

      if (
        url === `/api/v1/chats/${session.id}/completions/stream` &&
        method === 'POST'
      ) {
        const body = await readJsonBody(request)
        expect(body.imageAssetIds).toEqual([imageAsset.id])
        expect(body.conversationMode).toBe('regular')
        expect(body.crewTemplateId).toBeNull()
        sendSse(response, [
          {
            type: 'meta',
            sessionId: session.id,
            userMessage: {
              id: 'user-1',
              sessionId: session.id,
              role: 'user',
              content: 'hello there',
              selectedModel: 'gemma4:e2b',
              metadata: { imageAssetIds: [imageAsset.id] },
              createdAt: '2026-04-17T00:00:00.000Z',
            },
          },
          { type: 'token', content: 'mocked ' },
          { type: 'token', content: 'response' },
          {
            type: 'done',
            session: {
              ...session,
              title: 'hello there',
              updatedAt: '2026-04-17T00:00:01.000Z',
            },
            assistantMessage: {
              id: 'assistant-1',
              sessionId: session.id,
              role: 'assistant',
              content: 'mocked response',
              selectedModel: 'gemma4:e2b',
              metadata: {},
              createdAt: '2026-04-17T00:00:01.000Z',
            },
            orchestration: {
              enabled: false,
              mode: 'none',
              runId: null,
              status: null,
              stepCount: 0,
              summary: null,
            },
          },
        ])
        return
      }

      if (
        url === `/api/v1/chats/${session.id}/completions` &&
        method === 'POST'
      ) {
        const body = await readJsonBody(request)
        expect(body.imageAssetIds).toEqual([imageAsset.id])
        expect(body.conversationMode).toBe('regular')
        expect(body.crewTemplateId).toBeNull()
        sendJson(response, 200, {
          session,
          userMessage: {
            id: 'user-1',
            sessionId: session.id,
            role: 'user',
            content: 'hello there',
            selectedModel: 'gemma4:e2b',
            metadata: { imageAssetIds: [imageAsset.id] },
            createdAt: '2026-04-17T00:00:00.000Z',
          },
          assistantMessage: {
            id: 'assistant-1',
            sessionId: session.id,
            role: 'assistant',
            content: 'mocked response',
            selectedModel: 'gemma4:e2b',
            metadata: {},
            createdAt: '2026-04-17T00:00:01.000Z',
          },
          orchestration: {
            enabled: false,
            mode: 'none',
          },
        })
        return
      }

      sendJson(response, 404, {
        detail: `Unhandled mock route: ${method} ${url}`,
      })
    },
    async () => {
      await page.goto('/')
      await page.waitForTimeout(1000)

      await expect(
        page.getByRole('radio', { name: 'qwen3.5:2b' }),
      ).toBeChecked()
      await expect(
        page.getByRole('radio', { name: 'gemma4:e2b' }),
      ).toBeVisible()
      await expect(
        page.getByRole('radio', { name: 'gemma4-e2b-uncensored-q5_k_p' }),
      ).toBeVisible()
      await page.getByRole('radio', { name: 'gemma4:e2b' }).click()
      await expect(
        page.getByRole('button', { name: 'Upload image' }),
      ).toBeVisible()

      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles({
        name: 'screenshot.png',
        mimeType: 'image/png',
        buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      })
      await expect(page.getByText('screenshot.png')).toBeVisible()

      const composer = page.locator('textarea.composer__input')
      await composer.fill('hello there')
      await expect(composer).toHaveValue('hello there')
      const send = page.getByRole('button', { name: /Send/ })
      await expect(send).toBeEnabled()
      await send.click()

      await expect(page.getByText('mocked response')).toBeVisible()
      await expect(page.getByText('gemma4:e2b').nth(1)).toBeVisible()
    },
  )
})

test('chat page shows Ollama offline status before send', async ({ page }) => {
  await withMockApi(
    async (request, response) => {
      const url = request.url ?? ''
      const method = request.method ?? 'GET'

      if (url === '/api/v1/health' && method === 'GET') {
        sendJson(response, 200, {
          status: 'degraded',
          appName: 'local-first-ai-chat-api',
          allowedModels: [
            'qwen3.5:2b',
            'gemma4:e2b',
            'gemma4-e2b-uncensored-q5_k_p',
          ],
          agentOrchestrationEnabled: false,
          ollama: {
            ready: false,
            baseUrl: 'http://host.docker.internal:11434',
            availableModels: [],
            missingAllowedModels: [
              'qwen3.5:2b',
              'gemma4:e2b',
              'gemma4-e2b-uncensored-q5_k_p',
            ],
            error:
              'Ollama is unreachable or returned an invalid response while listing models.',
          },
          timestamp: '2026-04-17T00:00:00.000Z',
        })
        return
      }

      if (apiPath(url) === '/api/v1/chats' && method === 'GET') {
        sendJson(response, 200, emptyChatListPage())
        return
      }

      sendJson(response, 404, {
        detail: `Unhandled mock route: ${method} ${url}`,
      })
    },
    async () => {
      await page.goto('/')
      await page.waitForTimeout(1000)

      await expect(page.getByText('Ollama offline').first()).toBeVisible()
      await expect(
        page.getByText(/Ollama not running\. Start Ollama/i),
      ).toBeVisible()
      await expect(page.getByRole('button', { name: /Send/ })).toBeDisabled()
    },
  )
})

test('chat page shows the inspector and empty state', async ({ page }) => {
  await withMockApi(
    async (request, response) => {
      const url = request.url ?? ''
      const method = request.method ?? ''
      if (url === '/api/v1/health' && method === 'GET') {
        sendJson(response, 200, {
          status: 'ok',
          appName: 'local-first-ai-chat-api',
          allowedModels: ['qwen3.5:2b'],
          agentOrchestrationEnabled: false,
          ollama: {
            ready: true,
            baseUrl: 'http://127.0.0.1:11434',
            availableModels: ['qwen3.5:2b'],
            missingAllowedModels: [],
            error: null,
          },
          timestamp: '2026-04-17T00:00:00.000Z',
        })
        return
      }
      if (apiPath(url) === '/api/v1/chats' && method === 'GET') {
        sendJson(response, 200, emptyChatListPage())
        return
      }
      sendJson(response, 404, { detail: `Unhandled: ${method} ${url}` })
    },
    async () => {
      await page.goto('/')
      await expect(
        page.getByRole('heading', { name: 'Inspector' }),
      ).toBeVisible()
      await expect(page.getByText('Start a conversation')).toBeVisible()
    },
  )
})

async function withMockApi(
  handler: MockRouteHandler,
  run: () => Promise<void>,
) {
  const server = createServer((request, response) => {
    if (request.method === 'OPTIONS') {
      sendJson(response, 200, {})
      return
    }

    handler(request, response)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(mockApiPort, '127.0.0.1', () => resolve())
  })

  try {
    await run()
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  })
  response.end(JSON.stringify(payload))
}

function sendSse(response: ServerResponse, events: unknown[]) {
  response.writeHead(200, {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
    'Content-Type': 'text/event-stream',
  })
  response.end(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
  )
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const body = Buffer.concat(chunks).toString('utf8')
  return JSON.parse(body) as Record<string, unknown>
}
