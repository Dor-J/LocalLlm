import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionStreamEvent,
  OrchestrationRunDetail,
  OrchestrationRunRead,
  ChatSessionDetail,
  ChatSessionListPage,
  CreateChatSessionResponse,
  CreateChatSessionRequest,
  ImageAssetListPage,
  ImageAssetSummary,
  HealthResponse,
  RoleplayTemplateDetail,
  RoleplayTemplateSummary,
  RoleplayTemplateUpsertRequest,
} from '@local/shared'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { body?: string | undefined },
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const payload = (await response.json()) as { detail?: string }
      if (payload.detail) {
        message = payload.detail
      }
    } catch {
      // Ignore JSON parsing failures and fall back to the status-based message.
    }
    throw new ApiError(message, response.status)
  }

  return (await response.json()) as T
}

async function requestForm<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    body,
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const payload = (await response.json()) as { detail?: string }
      if (payload.detail) {
        message = payload.detail
      }
    } catch {
      // Ignore JSON parsing failures and fall back to the status-based message.
    }
    throw new ApiError(message, response.status)
  }

  return (await response.json()) as T
}

export function parseServerSentEventBlock(
  block: string,
): ChatCompletionStreamEvent | null {
  const dataLines = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())

  if (dataLines.length === 0) {
    return null
  }

  return JSON.parse(dataLines.join('\n')) as ChatCompletionStreamEvent
}

export interface ChatStreamHandlers {
  onMeta?: (event: Extract<ChatCompletionStreamEvent, { type: 'meta' }>) => void
  onToken?: (
    event: Extract<ChatCompletionStreamEvent, { type: 'token' }>,
  ) => void
  onDone?: (event: Extract<ChatCompletionStreamEvent, { type: 'done' }>) => void
  onError?: (
    event: Extract<ChatCompletionStreamEvent, { type: 'error' }>,
  ) => void
  signal?: AbortSignal
}

export function drainSseBuffer(
  buffer: string,
  handlers: ChatStreamHandlers,
  flush = false,
): string {
  const separator = /\r?\n\r?\n/
  let remaining = buffer

  while (true) {
    const match = separator.exec(remaining)
    if (!match) {
      break
    }
    const block = remaining.slice(0, match.index)
    remaining = remaining.slice(match.index + match[0].length)
    dispatchStreamEvent(parseServerSentEventBlock(block), handlers)
  }

  if (flush && remaining.trim()) {
    dispatchStreamEvent(parseServerSentEventBlock(remaining), handlers)
    return ''
  }

  return remaining
}

async function streamRequest(
  path: string,
  init: RequestInit & { body: string },
  handlers: ChatStreamHandlers,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    ...init,
    signal: handlers.signal,
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const payload = (await response.json()) as { detail?: string }
      if (payload.detail) {
        message = payload.detail
      }
    } catch {
      // Ignore JSON parsing failures and fall back to the status-based message.
    }
    throw new ApiError(message, response.status)
  }

  if (!response.body) {
    throw new ApiError(
      'Streaming response body is unavailable.',
      response.status,
    )
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      buffer += decoder.decode(value, { stream: true })
      buffer = drainSseBuffer(buffer, handlers)
    }
    buffer += decoder.decode()
    drainSseBuffer(buffer, handlers, true)
  } finally {
    reader.releaseLock()
  }
}

function dispatchStreamEvent(
  event: ChatCompletionStreamEvent | null,
  handlers: ChatStreamHandlers,
) {
  if (!event) {
    return
  }
  switch (event.type) {
    case 'meta':
      handlers.onMeta?.(event)
      break
    case 'token':
      handlers.onToken?.(event)
      break
    case 'done':
      handlers.onDone?.(event)
      break
    case 'error':
      handlers.onError?.(event)
      break
  }
}

export const api = {
  health() {
    return request<HealthResponse>('/health')
  },
  listSessions() {
    const params = new URLSearchParams({ limit: '500', offset: '0' })
    return request<ChatSessionListPage>(`/chats?${params}`).then(
      (page) => page.items,
    )
  },
  createSession(payload: CreateChatSessionRequest = {}) {
    return request<CreateChatSessionResponse>('/chats', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  getSession(sessionId: string) {
    return request<ChatSessionDetail>(`/chats/${sessionId}`)
  },
  sendMessage(sessionId: string, payload: ChatCompletionRequest) {
    return request<ChatCompletionResponse>(`/chats/${sessionId}/completions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  streamMessage(
    sessionId: string,
    payload: ChatCompletionRequest,
    handlers: ChatStreamHandlers,
  ) {
    return streamRequest(
      `/chats/${sessionId}/completions/stream`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      handlers,
    )
  },
  listImages(sessionId?: string) {
    const params = new URLSearchParams({ limit: '500', offset: '0' })
    if (sessionId) {
      params.set('session_id', sessionId)
    }
    return request<ImageAssetListPage>(`/images?${params}`).then(
      (page) => page.items,
    )
  },
  uploadImage(sessionId: string, file: File) {
    const formData = new FormData()
    formData.append('session_id', sessionId)
    formData.append('file', file)
    return requestForm<ImageAssetSummary>('/images', formData)
  },
  deleteImage(imageId: string) {
    return request<{ deleted: true }>(`/images/${imageId}`, {
      method: 'DELETE',
    })
  },
  deleteSession(sessionId: string) {
    return request<{ deleted: true }>(`/chats/${sessionId}`, {
      method: 'DELETE',
    })
  },
  listOrchestrationRuns(sessionId: string) {
    return request<OrchestrationRunRead[]>(`/chats/${sessionId}/runs`)
  },
  getOrchestrationRun(runId: string) {
    return request<OrchestrationRunDetail>(`/runs/${runId}`)
  },
  listRoleplayTemplates() {
    return request<RoleplayTemplateSummary[]>('/roleplays/templates')
  },
  getRoleplayTemplate(templateId: string) {
    return request<RoleplayTemplateDetail>(`/roleplays/templates/${templateId}`)
  },
  createRoleplayTemplate(payload: RoleplayTemplateUpsertRequest) {
    return request<RoleplayTemplateDetail>('/roleplays/templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  updateRoleplayTemplate(
    templateId: string,
    payload: RoleplayTemplateUpsertRequest,
  ) {
    return request<RoleplayTemplateDetail>(
      `/roleplays/templates/${templateId}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    )
  },
  deleteRoleplayTemplate(templateId: string) {
    return request<{ deleted: true }>(`/roleplays/templates/${templateId}`, {
      method: 'DELETE',
    })
  },
}

export { ApiError }
