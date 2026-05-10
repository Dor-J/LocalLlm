/**
 * Router-loader payload: prefetches everything the first paint needs and
 * hydrates the React Query cache so `useQuery` hooks start with data rather
 * than loading spinners (P1-WEB-01, P1-WEB-03).
 */

import type {
  ChatMessage,
  ChatModel,
  ChatSessionSummary,
  ConversationMode,
  CrewTemplateId,
  HealthResponse,
  OrchestrationRunDetail,
  OrchestrationRunRead,
} from '@local/shared'
import { DEFAULT_CHAT_MODEL, DEFAULT_CONVERSATION_MODE } from '@local/shared'
import type { QueryClient } from '@tanstack/react-query'
import { api } from '~/lib/api'
import { chatKeys } from '~/lib/query-client'
import { getErrorMessage, resolveSessionSelectedModel } from './utils'

export interface InitialChatState {
  health: HealthResponse | null
  sessions: ChatSessionSummary[]
  activeSessionId: string | null
  messages: ChatMessage[]
  selectedModel: ChatModel
  conversationMode: ConversationMode
  crewTemplateId: CrewTemplateId | null
  orchestrationRuns: OrchestrationRunRead[]
  selectedRunId: string | null
  selectedRun: OrchestrationRunDetail | null
  error: string | null
}

/**
 * Server-side loader that primes the query cache; mirrors the shape expected
 * by the chat page hooks. Returns a degraded payload with `error` populated
 * rather than throwing, so the page still renders on API outages.
 */
export async function loadInitialChatState(
  client: QueryClient,
): Promise<InitialChatState> {
  try {
    const [health, sessions] = await Promise.all([
      client.fetchQuery({
        queryKey: chatKeys.health,
        queryFn: api.health,
        staleTime: 0,
      }),
      client.fetchQuery({
        queryKey: chatKeys.sessions,
        queryFn: api.listSessions,
        staleTime: 0,
      }),
    ])
    const firstSession = sessions[0]

    if (!firstSession) {
      return {
        health,
        sessions,
        activeSessionId: null,
        messages: [],
        selectedModel: DEFAULT_CHAT_MODEL,
        conversationMode: DEFAULT_CONVERSATION_MODE,
        crewTemplateId: null,
        orchestrationRuns: [],
        selectedRunId: null,
        selectedRun: null,
        error: null,
      }
    }

    const detail = await client.fetchQuery({
      queryKey: chatKeys.session(firstSession.id),
      queryFn: () => api.getSession(firstSession.id),
      staleTime: 0,
    })
    let orchestrationRuns: OrchestrationRunRead[] = []
    let selectedRunId: string | null = null
    let selectedRun: OrchestrationRunDetail | null = null
    try {
      orchestrationRuns = await client.fetchQuery({
        queryKey: chatKeys.runs(detail.session.id),
        queryFn: () => api.listOrchestrationRuns(detail.session.id),
        staleTime: 0,
      })
      selectedRunId = orchestrationRuns[0]?.id ?? null
      selectedRun = selectedRunId
        ? await client.fetchQuery({
            queryKey: chatKeys.run(selectedRunId),
            queryFn: () => api.getOrchestrationRun(selectedRunId as string),
            staleTime: 0,
          })
        : null
    } catch {
      orchestrationRuns = []
      selectedRunId = null
      selectedRun = null
    }
    return {
      health,
      sessions,
      activeSessionId: detail.session.id,
      messages: detail.messages,
      selectedModel: resolveSessionSelectedModel(detail.messages),
      conversationMode: detail.session.conversationMode,
      crewTemplateId: detail.session.crewTemplateId,
      orchestrationRuns,
      selectedRunId,
      selectedRun,
      error: null,
    }
  } catch (cause) {
    return {
      health: null,
      sessions: [],
      activeSessionId: null,
      messages: [],
      selectedModel: DEFAULT_CHAT_MODEL,
      conversationMode: DEFAULT_CONVERSATION_MODE,
      crewTemplateId: null,
      orchestrationRuns: [],
      selectedRunId: null,
      selectedRun: null,
      error: getErrorMessage(cause),
    }
  }
}
