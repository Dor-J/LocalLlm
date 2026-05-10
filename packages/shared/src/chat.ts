/**
 * Hand-written chat types.
 *
 * These will migrate to `schemas.*` incrementally as new DTOs are added.
 * New DTOs should import from `@local/shared` and prefer `schemas.<Name>`
 * over adding new hand-typed duplicates here. Regenerate the namespace with
 * `bun run codegen:openapi`.
 */
export const SUPPORTED_MODELS = [
  'qwen3.5:2b',
  'gemma4:e2b',
  'gemma4-e2b-uncensored-q5_k_p',
] as const
export const CONVERSATION_MODES = ['regular', 'roleplay', 'task'] as const
export const CREW_TEMPLATES = [
  'roleplay-fantasy',
  'roleplay-debate',
  'research-assistant',
] as const
export const DEFAULT_CHAT_MODEL: ChatModel = 'qwen3.5:2b'
export const DEFAULT_CONVERSATION_MODE: ConversationMode = 'regular'
export const DEFAULT_ROLEPLAY_TEMPLATE: CrewTemplateId = 'roleplay-fantasy'

export type ChatModel = (typeof SUPPORTED_MODELS)[number]
export type ConversationMode = (typeof CONVERSATION_MODES)[number]
export type CrewTemplateId = (typeof CREW_TEMPLATES)[number]

export type MessageRole = 'system' | 'user' | 'assistant'

export interface ChatSessionSummary {
  id: string
  title: string | null
  conversationMode: ConversationMode
  crewTemplateId: CrewTemplateId | null
  sceneState: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: MessageRole
  content: string
  selectedModel: ChatModel | null
  metadata: Record<string, unknown>
  createdAt: string
}

export interface ChatSessionDetail {
  session: ChatSessionSummary
  messages: ChatMessage[]
}

/** Paginated `GET /chats` response (camelCase matches API `APIModel`). */
export interface ChatSessionListPage {
  items: ChatSessionSummary[]
  total: number
  limit: number
  offset: number
}

/** Paginated `GET /chats/{id}/messages` response. */
export interface ChatMessageListPage {
  items: ChatMessage[]
  total: number
  limit: number
  offset: number
}

export interface CreateChatSessionRequest {
  title?: string | null
  conversationMode?: ConversationMode
  crewTemplateId?: CrewTemplateId | null
}

export interface CreateChatSessionResponse {
  session: ChatSessionSummary
}

export interface ChatCompletionRequest {
  content: string
  selectedModel: ChatModel
  agentMode?: boolean
  roleplayEnabled?: boolean
  imageAssetIds?: string[]
  conversationMode?: ConversationMode
  crewTemplateId?: CrewTemplateId | null
}

export interface ChatCompletionResponse {
  session: ChatSessionSummary
  userMessage: ChatMessage
  assistantMessage: ChatMessage
  orchestration: {
    enabled: boolean
    mode: 'none' | 'experimental-composio' | 'crewai'
    runId: string | null
    status: string | null
    stepCount: number
    summary: string | null
  }
}

export type ChatCompletionStreamEvent =
  | {
      type: 'meta'
      sessionId: string
      userMessage: ChatMessage
    }
  | {
      type: 'token'
      content: string
    }
  | {
      type: 'done'
      session: ChatSessionSummary
      assistantMessage: ChatMessage
      orchestration: ChatCompletionResponse['orchestration']
    }
  | {
      type: 'error'
      code: string
      detail: string
    }

export interface OrchestrationStepRead {
  id: string
  runId: string
  stepIndex: number
  role: string
  status: string
  inputText: string | null
  outputText: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export interface OrchestrationRunRead {
  id: string
  sessionId: string
  triggerMessageId: string | null
  backend: string
  conversationMode: ConversationMode
  crewTemplateId: CrewTemplateId | null
  status: string
  prompt: string
  metadata: Record<string, unknown>
  createdAt: string
  completedAt: string | null
  stepCount: number
}

export interface OrchestrationRunDetail extends OrchestrationRunRead {
  steps: OrchestrationStepRead[]
}

export interface HealthResponse {
  status: 'ok' | 'degraded'
  appName: string
  allowedModels: ChatModel[]
  agentOrchestrationEnabled: boolean
  ollama: {
    ready: boolean
    baseUrl: string
    availableModels: string[]
    missingAllowedModels: ChatModel[]
    error: string | null
  }
  timestamp: string
}

export interface EmbeddingIndexRequest {
  content: string
  sourceType: string
  sourceUri?: string | null
  embedding?: number[] | null
  embeddingModel?: string | null
  metadata?: Record<string, unknown>
}

export interface EmbeddingSearchRequest {
  queryEmbedding: number[]
  limit?: number
}

export interface EmbeddingSearchResult {
  embeddingRecordId: string
  chunkId: string
  content: string
  distance: number
  sourceType: string
  sourceUri: string | null
}

export interface ImageAssetSummary {
  id: string
  sessionId: string
  fileName: string
  contentType: string
  byteSize: number
  sha256: string
  contentUrl: string
  metadata: Record<string, unknown>
  createdAt: string
}

/** Paginated `GET /images` response. */
export interface ImageAssetListPage {
  items: ImageAssetSummary[]
  total: number
  limit: number
  offset: number
}

export type RoleplayCrewTemplateId = 'roleplay-fantasy' | 'roleplay-debate'

export interface RoleplayRole {
  id: string
  templateId: string
  name: string
  description: string | null
  systemPrompt: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface RoleplayRoleDraft {
  id?: string | null
  name: string
  description?: string | null
  systemPrompt: string
}

export interface RoleplayTemplateSummary {
  id: string
  name: string
  description: string | null
  crewTemplateId: RoleplayCrewTemplateId
  sceneState: Record<string, unknown>
  roleCount: number
  createdAt: string
  updatedAt: string
}

export interface RoleplayTemplateDetail {
  id: string
  name: string
  description: string | null
  crewTemplateId: RoleplayCrewTemplateId
  sceneState: Record<string, unknown>
  roles: RoleplayRole[]
  createdAt: string
  updatedAt: string
}

export interface RoleplayTemplateUpsertRequest {
  name: string
  description?: string | null
  crewTemplateId: RoleplayCrewTemplateId
  sceneState: Record<string, unknown>
  roles: RoleplayRoleDraft[]
}
