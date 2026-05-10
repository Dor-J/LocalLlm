/**
 * Sessions list + active-session detail + send/delete mutations.
 * Owns all the React Query wiring for `chatKeys.sessions` and
 * `chatKeys.session(id)` so the chat page only sees high-level state
 * (P1-WEB-03).
 */

import type {
  ChatMessage,
  ChatSessionDetail,
  ChatSessionSummary,
} from '@local/shared'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from '~/lib/api'
import { chatKeys } from '~/lib/query-client'
import type { InitialChatState } from './initial-state'
import { buildOptimisticUserMessage, createOptimisticId } from './utils'

type SendMessagePayload = Parameters<typeof api.sendMessage>[1]

interface SendMessageVars {
  sessionId: string
  payload: SendMessagePayload
}

interface SendMessageContext {
  sessionId: string
  tempId: string
  previousDetail: ChatSessionDetail | undefined
}

export interface UseChatSessionsArgs {
  initial: InitialChatState
  activeSessionId: string | null
}

export interface UseChatSessionsResult {
  sessions: ChatSessionSummary[]
  sessionDetail: ChatSessionDetail | null
  isLoadingSession: boolean
  messages: ChatSessionDetail['messages']
  activeSession: ChatSessionSummary | null
  sendMessageMutation: UseMutationResult<
    Awaited<ReturnType<typeof api.sendMessage>>,
    Error,
    SendMessageVars,
    SendMessageContext
  >
  deleteSessionMutation: UseMutationResult<unknown, Error, string, unknown>
}

export function useChatSessions({
  initial,
  activeSessionId,
}: UseChatSessionsArgs): UseChatSessionsResult {
  const queryClient = useQueryClient()

  const sessionsQuery = useQuery<ChatSessionSummary[]>({
    queryKey: chatKeys.sessions,
    queryFn: api.listSessions,
    initialData: initial.sessions,
  })
  const sessions = useMemo(
    () => sessionsQuery.data ?? [],
    [sessionsQuery.data],
  )

  const sessionDetailQuery = useQuery<ChatSessionDetail>({
    queryKey: activeSessionId
      ? chatKeys.session(activeSessionId)
      : (['session', 'none'] as const),
    queryFn: () => api.getSession(activeSessionId as string),
    enabled: Boolean(activeSessionId),
    initialData:
      activeSessionId && activeSessionId === initial.activeSessionId
        ? ({
            session: sessions.find(
              (session) => session.id === activeSessionId,
            )!,
            messages: initial.messages,
          } as ChatSessionDetail)
        : undefined,
  })

  const sendMessageMutation = useMutation<
    Awaited<ReturnType<typeof api.sendMessage>>,
    Error,
    SendMessageVars,
    SendMessageContext
  >({
    mutationFn: ({ sessionId, payload }) => api.sendMessage(sessionId, payload),
    onMutate: async ({ sessionId, payload }) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.session(sessionId) })
      const previousDetail = queryClient.getQueryData<ChatSessionDetail>(
        chatKeys.session(sessionId),
      )
      const tempId = createOptimisticId()
      const tempMessage = buildOptimisticUserMessage({
        sessionId,
        tempId,
        content: payload.content,
        selectedModel: payload.selectedModel,
      })
      queryClient.setQueryData<ChatSessionDetail>(
        chatKeys.session(sessionId),
        (previous) =>
          previous
            ? {
                session: previous.session,
                messages: [...previous.messages, tempMessage],
              }
            : previous,
      )
      return { sessionId, tempId, previousDetail }
    },
    onError: (_error, { sessionId }, context) => {
      if (!context) {
        return
      }
      queryClient.setQueryData<ChatSessionDetail>(
        chatKeys.session(sessionId),
        (previous) => {
          if (!previous) {
            return context.previousDetail
          }
          return {
            session: previous.session,
            messages: previous.messages.map((message) =>
              message?.id === context.tempId
                ? {
                    ...message,
                    metadata: { ...message.metadata, clientStatus: 'failed' },
                  }
                : message,
            ),
          }
        },
      )
    },
    onSuccess: (response, _variables, context) => {
      const tempId = context?.tempId
      queryClient.setQueryData<ChatSessionDetail>(
        chatKeys.session(response.session.id),
        (previous) => {
          const base = previous?.messages ?? []
          const pruned = tempId
            ? base.filter((message) => message?.id !== tempId)
            : base
          const nextMessages: ChatMessage[] = [...pruned]
          if (response.userMessage?.id) {
            nextMessages.push(response.userMessage)
          }
          if (response.assistantMessage?.id) {
            nextMessages.push(response.assistantMessage)
          }
          return {
            session: response.session,
            messages: nextMessages,
          }
        },
      )
      queryClient.setQueryData<ChatSessionSummary[]>(
        chatKeys.sessions,
        (previous) => {
          const base = previous ?? []
          const filtered = base.filter(
            (session) => session.id !== response.session.id,
          )
          return [response.session, ...filtered].sort(
            (left, right) =>
              new Date(right.updatedAt).valueOf() -
              new Date(left.updatedAt).valueOf(),
          )
        },
      )
      void queryClient.invalidateQueries({
        queryKey: chatKeys.runs(response.session.id),
      })
    },
  })

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) => api.deleteSession(sessionId),
    onSuccess: (_result, sessionId) => {
      queryClient.setQueryData<ChatSessionSummary[]>(
        chatKeys.sessions,
        (previous) =>
          (previous ?? []).filter((session) => session.id !== sessionId),
      )
      queryClient.removeQueries({ queryKey: chatKeys.session(sessionId) })
      queryClient.removeQueries({ queryKey: chatKeys.runs(sessionId) })
    },
  })

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  )

  const messages = useMemo(() => {
    const raw = sessionDetailQuery.data?.messages ?? []
    return raw.filter(
      (m): m is ChatMessage =>
        m != null &&
        typeof m === 'object' &&
        typeof m.id === 'string' &&
        m.id.length > 0,
    )
  }, [sessionDetailQuery.data?.messages])

  return {
    sessions,
    sessionDetail: sessionDetailQuery.data ?? null,
    isLoadingSession:
      sessionDetailQuery.isFetching && !sessionDetailQuery.isSuccess,
    messages,
    activeSession,
    sendMessageMutation,
    deleteSessionMutation,
  }
}
