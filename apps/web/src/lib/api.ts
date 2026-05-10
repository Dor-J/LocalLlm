import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
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

export const api = {
  health() {
    return request<HealthResponse>('/health')
  },
  listSessions() {
    const params = new URLSearchParams({ limit: '500', offset: '0' })
    return request<ChatSessionListPage>(`/chats?${params}`).then((page) => page.items)
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
  listImages(sessionId?: string) {
    const params = new URLSearchParams({ limit: '500', offset: '0' })
    if (sessionId) {
      params.set('session_id', sessionId)
    }
    return request<ImageAssetListPage>(`/images?${params}`).then((page) => page.items)
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
  updateRoleplayTemplate(templateId: string, payload: RoleplayTemplateUpsertRequest) {
    return request<RoleplayTemplateDetail>(`/roleplays/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },
  deleteRoleplayTemplate(templateId: string) {
    return request<{ deleted: true }>(`/roleplays/templates/${templateId}`, {
      method: 'DELETE',
    })
  },
}

export { ApiError }
