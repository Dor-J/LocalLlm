/**
 * Action bundle for the chat page: creating / loading / deleting sessions,
 * sending messages, uploading images, and refreshing health. These callbacks
 * intentionally live outside the individual hooks because they read/write
 * state across *all* of them; consolidating here keeps the route component
 * thin (P1-WEB-03).
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
  ChatSessionDetail,
  ChatSessionSummary,
  ConversationMode,
  CrewTemplateId,
} from '@local/shared'
import { DEFAULT_CONVERSATION_MODE } from '@local/shared'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { startTransition, useCallback, useState } from 'react'
import { ApiError, api } from '~/lib/api'
import { chatKeys } from '~/lib/query-client'
import type { ChatCapabilities } from './capabilities'
import type { UseChatDraftResult } from './use-chat-draft'
import type { UseChatSessionsResult } from './use-chat-sessions'
import type { UseRuntimeHealthResult } from './use-runtime-health'
import {
  buildOptimisticAssistantMessage,
  buildOptimisticUserMessage,
  createOptimisticId,
  getErrorMessage,
  resolveCrewTemplateId,
  resolveSessionSelectedModel,
} from './utils'

export interface UseChatActionsArgs {
  activeSessionId: string | null
  setActiveSessionId: (next: string | null) => void
  setSelectedRunId: (next: string | null) => void
  setError: (next: string | null) => void
  draft: UseChatDraftResult
  chatSessions: UseChatSessionsResult
  runtimeHealth: UseRuntimeHealthResult
  capabilities: ChatCapabilities
  currentConversationMode: ConversationMode
  currentCrewTemplateId: CrewTemplateId | null
  /** Called after a message is sent successfully and draft is cleared. */
  onSendSuccess?: () => void
}

export interface ChatPageActions {
  isSending: boolean
  loadSession: (sessionId: string) => Promise<void>
  startNewChat: () => void
  deleteSession: (sessionId: string) => Promise<void>
  sendMessage: (draftText: string) => Promise<void>
  refreshHealth: () => Promise<void>
  uploadImage: (file: File) => Promise<void>
  removeImage: (imageId: string) => Promise<void>
}

export function useChatActions({
  activeSessionId,
  setActiveSessionId,
  setSelectedRunId,
  setError,
  draft,
  chatSessions,
  runtimeHealth,
  capabilities,
  currentConversationMode,
  currentCrewTemplateId,
  onSendSuccess,
}: UseChatActionsArgs): ChatPageActions {
  const queryClient = useQueryClient()
  const { sendMessageMutation, deleteSessionMutation } = chatSessions
  const [isStreamingMessage, setIsStreamingMessage] = useState(false)
  const isSending = sendMessageMutation.isPending || isStreamingMessage

  const loadSession = useCallback(
    async (sessionId: string) => {
      if (activeSessionId === sessionId) {
        return
      }
      setError(null)
      try {
        const detail = await queryClient.ensureQueryData({
          queryKey: chatKeys.session(sessionId),
          queryFn: () => api.getSession(sessionId),
        })
        startTransition(() => {
          setActiveSessionId(detail.session.id)
          draft.setDraftImages([])
          draft.setConversationMode(detail.session.conversationMode)
          draft.setCrewTemplateId(
            resolveCrewTemplateId(
              detail.session.conversationMode,
              detail.session.crewTemplateId,
            ),
          )
          draft.setSelectedModel(resolveSessionSelectedModel(detail.messages))
          setSelectedRunId(null)
        })
      } catch (cause) {
        setError(getErrorMessage(cause))
      }
    },
    [
      activeSessionId,
      draft,
      queryClient,
      setActiveSessionId,
      setError,
      setSelectedRunId,
    ],
  )

  const startNewChat = useCallback(() => {
    setError(null)
    startTransition(() => {
      setActiveSessionId(null)
      draft.setDraftImages([])
      draft.setConversationMode(DEFAULT_CONVERSATION_MODE)
      draft.setCrewTemplateId(null)
      setSelectedRunId(null)
    })
  }, [draft, setActiveSessionId, setError, setSelectedRunId])

  const deleteSession = useCallback(
    async (sessionId: string) => {
      setError(null)
      try {
        await deleteSessionMutation.mutateAsync(sessionId)
        if (activeSessionId === sessionId) {
          const remaining =
            queryClient.getQueryData<ChatSessionSummary[]>(chatKeys.sessions) ??
            []
          const next = remaining[0]
          if (next) {
            await loadSession(next.id)
          } else {
            startTransition(() => {
              setActiveSessionId(null)
              draft.setDraftImages([])
              setSelectedRunId(null)
            })
          }
        }
      } catch (cause) {
        setError(getErrorMessage(cause))
      }
    },
    [
      activeSessionId,
      deleteSessionMutation,
      draft,
      loadSession,
      queryClient,
      setActiveSessionId,
      setError,
      setSelectedRunId,
    ],
  )

  const ensureSessionId = useCallback(async (): Promise<string | null> => {
    if (activeSessionId) {
      return activeSessionId
    }
    try {
      const created = await api.createSession({
        conversationMode: currentConversationMode,
        crewTemplateId: currentCrewTemplateId,
      })
      queryClient.setQueryData<ChatSessionSummary[]>(
        chatKeys.sessions,
        (previous) => [created.session, ...(previous ?? [])],
      )
      queryClient.setQueryData<ChatSessionDetail>(
        chatKeys.session(created.session.id),
        { session: created.session, messages: [] },
      )
      startTransition(() => {
        setActiveSessionId(created.session.id)
        draft.setConversationMode(created.session.conversationMode)
        draft.setCrewTemplateId(
          resolveCrewTemplateId(
            created.session.conversationMode,
            created.session.crewTemplateId,
          ),
        )
        draft.setDraftImages([])
        setSelectedRunId(null)
      })
      return created.session.id
    } catch (cause) {
      setError(getErrorMessage(cause))
      return null
    }
  }, [
    activeSessionId,
    currentConversationMode,
    currentCrewTemplateId,
    draft,
    queryClient,
    setActiveSessionId,
    setError,
    setSelectedRunId,
  ])

  const refreshHealth = useCallback(async () => {
    try {
      await runtimeHealth.refresh()
    } catch (cause) {
      setError(getErrorMessage(cause))
    }
  }, [runtimeHealth, setError])

  const finalizeStreamSession = useCallback(
    async (session: ChatSessionSummary) => {
      applyStreamSessionUpdate({ queryClient, session })
      startTransition(() => {
        draft.setConversationMode(session.conversationMode)
        draft.setCrewTemplateId(
          resolveCrewTemplateId(
            session.conversationMode,
            session.crewTemplateId,
          ),
        )
      })
      await queryClient.invalidateQueries({
        queryKey: chatKeys.runs(session.id),
      })
    },
    [draft, queryClient],
  )

  const finalizeResponseSession = useCallback(
    async (response: ChatCompletionResponse) => {
      startTransition(() => {
        draft.setConversationMode(response.session.conversationMode)
        draft.setCrewTemplateId(
          resolveCrewTemplateId(
            response.session.conversationMode,
            response.session.crewTemplateId,
          ),
        )
      })
      if (response.orchestration.runId) {
        setSelectedRunId(response.orchestration.runId)
      }
      await queryClient.invalidateQueries({
        queryKey: chatKeys.runs(response.session.id),
      })
    },
    [draft, queryClient, setSelectedRunId],
  )

  const sendMessage = useCallback(
    async (draftText: string) => {
      const content = draftText.trim()
      if (!content || isSending || !capabilities.canSendMessages) {
        return
      }
      const sessionId = await ensureSessionId()
      if (!sessionId) {
        return
      }
      const payload: ChatCompletionRequest = {
        content,
        selectedModel: draft.selectedModel,
        agentMode: currentConversationMode !== 'regular',
        roleplayEnabled: currentConversationMode === 'roleplay',
        imageAssetIds: draft.draftImages.map((image) => image.id),
        conversationMode: currentConversationMode,
        crewTemplateId: currentCrewTemplateId,
      }
      const tempUserId = createOptimisticId()
      const tempAssistantId = createOptimisticId()
      setError(null)
      setIsStreamingMessage(true)
      appendOptimisticStreamTurn({
        queryClient,
        sessionId,
        userMessage: buildOptimisticUserMessage({
          sessionId,
          tempId: tempUserId,
          content,
          selectedModel: draft.selectedModel,
        }),
        assistantMessage: buildOptimisticAssistantMessage({
          sessionId,
          tempId: tempAssistantId,
          selectedModel: draft.selectedModel,
        }),
      })
      draft.clearForSendSuccess()
      onSendSuccess?.()

      let metaReceived = false
      let doneReceived = false
      let streamError: Error | null = null
      let completedSession: ChatSessionSummary | null = null

      try {
        await api.streamMessage(sessionId, payload, {
          onMeta: (event) => {
            metaReceived = true
            replaceMessage({
              queryClient,
              sessionId,
              tempId: tempUserId,
              message: event.userMessage,
            })
          },
          onToken: (event) => {
            appendAssistantToken({
              queryClient,
              sessionId,
              tempId: tempAssistantId,
              content: event.content,
            })
          },
          onDone: (event) => {
            doneReceived = true
            completedSession = event.session
            replaceMessage({
              queryClient,
              sessionId,
              tempId: tempAssistantId,
              message: event.assistantMessage,
            })
            if (event.orchestration.runId) {
              setSelectedRunId(event.orchestration.runId)
            }
          },
          onError: (event) => {
            streamError = new Error(event.detail || event.code)
          },
        })

        if (streamError) {
          throw streamError
        }
        if (!doneReceived) {
          throw new Error('The streaming response ended before completion.')
        }
        if (completedSession) {
          await finalizeStreamSession(completedSession)
        }
      } catch (cause) {
        if (!metaReceived) {
          try {
            const response = await api.sendMessage(sessionId, payload)
            applyCompletedFallbackTurn({
              queryClient,
              response,
              tempUserId,
              tempAssistantId,
            })
            await finalizeResponseSession(response)
            return
          } catch (fallbackCause) {
            markStreamTurnFailed({
              queryClient,
              sessionId,
              tempUserId,
              tempAssistantId,
            })
            draft.setDraft(content)
            setError(getErrorMessage(fallbackCause))
            if (
              fallbackCause instanceof ApiError &&
              fallbackCause.status >= 500
            ) {
              await refreshHealth()
            }
            return
          }
        }

        markStreamTurnFailed({
          queryClient,
          sessionId,
          tempUserId,
          tempAssistantId,
        })
        setError(getErrorMessage(cause))
        if (cause instanceof ApiError && cause.status >= 500) {
          await refreshHealth()
        }
      } finally {
        setIsStreamingMessage(false)
      }
    },
    [
      capabilities.canSendMessages,
      currentConversationMode,
      currentCrewTemplateId,
      draft,
      ensureSessionId,
      onSendSuccess,
      isSending,
      queryClient,
      finalizeStreamSession,
      finalizeResponseSession,
      refreshHealth,
      setError,
      setSelectedRunId,
    ],
  )

  const uploadImage = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError('Only image uploads are supported.')
        return
      }
      setError(null)
      draft.setIsUploadingImage(true)
      const sessionId = await ensureSessionId()
      if (!sessionId) {
        draft.setIsUploadingImage(false)
        return
      }
      try {
        const uploaded = await api.uploadImage(sessionId, file)
        draft.setDraftImages((previous) => [...previous, uploaded])
      } catch (cause) {
        setError(getErrorMessage(cause))
      } finally {
        draft.setIsUploadingImage(false)
      }
    },
    [draft, ensureSessionId, setError],
  )

  const removeImage = useCallback(
    async (imageId: string) => {
      setError(null)
      try {
        await api.deleteImage(imageId)
        draft.setDraftImages((previous) =>
          previous.filter((image) => image.id !== imageId),
        )
      } catch (cause) {
        setError(getErrorMessage(cause))
      }
    },
    [draft, setError],
  )

  return {
    isSending,
    loadSession,
    startNewChat,
    deleteSession,
    sendMessage,
    refreshHealth,
    uploadImage,
    removeImage,
  }
}

function appendOptimisticStreamTurn(args: {
  queryClient: QueryClient
  sessionId: string
  userMessage: ChatMessage
  assistantMessage: ChatMessage
}) {
  args.queryClient.setQueryData<ChatSessionDetail>(
    chatKeys.session(args.sessionId),
    (previous) =>
      previous
        ? {
            session: previous.session,
            messages: [
              ...previous.messages,
              args.userMessage,
              args.assistantMessage,
            ],
          }
        : previous,
  )
}

function replaceMessage(args: {
  queryClient: QueryClient
  sessionId: string
  tempId: string
  message: ChatMessage
}) {
  args.queryClient.setQueryData<ChatSessionDetail>(
    chatKeys.session(args.sessionId),
    (previous) =>
      previous
        ? {
            session: previous.session,
            messages: previous.messages.map((message) =>
              message.id === args.tempId ? args.message : message,
            ),
          }
        : previous,
  )
}

function appendAssistantToken(args: {
  queryClient: QueryClient
  sessionId: string
  tempId: string
  content: string
}) {
  args.queryClient.setQueryData<ChatSessionDetail>(
    chatKeys.session(args.sessionId),
    (previous) =>
      previous
        ? {
            session: previous.session,
            messages: previous.messages.map((message) =>
              message.id === args.tempId
                ? { ...message, content: message.content + args.content }
                : message,
            ),
          }
        : previous,
  )
}

function markStreamTurnFailed(args: {
  queryClient: QueryClient
  sessionId: string
  tempUserId: string
  tempAssistantId: string
}) {
  args.queryClient.setQueryData<ChatSessionDetail>(
    chatKeys.session(args.sessionId),
    (previous) =>
      previous
        ? {
            session: previous.session,
            messages: previous.messages.map((message) => {
              if (message.id === args.tempUserId) {
                return {
                  ...message,
                  metadata: { ...message.metadata, clientStatus: 'failed' },
                }
              }
              if (message.id === args.tempAssistantId) {
                return {
                  ...message,
                  metadata: { ...message.metadata, clientStatus: 'failed' },
                }
              }
              return message
            }),
          }
        : previous,
  )
}

function applyCompletedFallbackTurn(args: {
  queryClient: QueryClient
  response: ChatCompletionResponse
  tempUserId: string
  tempAssistantId: string
}) {
  args.queryClient.setQueryData<ChatSessionDetail>(
    chatKeys.session(args.response.session.id),
    (previous) => {
      const base = previous?.messages ?? []
      const pruned = base.filter(
        (message) =>
          message.id !== args.tempUserId && message.id !== args.tempAssistantId,
      )
      return {
        session: args.response.session,
        messages: [
          ...pruned,
          args.response.userMessage,
          args.response.assistantMessage,
        ],
      }
    },
  )
  args.queryClient.setQueryData<ChatSessionSummary[]>(
    chatKeys.sessions,
    (previous) => {
      const base = previous ?? []
      const filtered = base.filter(
        (session) => session.id !== args.response.session.id,
      )
      return [args.response.session, ...filtered].sort(
        (left, right) =>
          new Date(right.updatedAt).valueOf() -
          new Date(left.updatedAt).valueOf(),
      )
    },
  )
}

function applyStreamSessionUpdate(args: {
  queryClient: QueryClient
  session: ChatSessionSummary
}) {
  args.queryClient.setQueryData<ChatSessionDetail>(
    chatKeys.session(args.session.id),
    (previous) =>
      previous
        ? {
            session: args.session,
            messages: previous.messages,
          }
        : previous,
  )
  args.queryClient.setQueryData<ChatSessionSummary[]>(
    chatKeys.sessions,
    (previous) => {
      const base = previous ?? []
      const filtered = base.filter((session) => session.id !== args.session.id)
      return [args.session, ...filtered].sort(
        (left, right) =>
          new Date(right.updatedAt).valueOf() -
          new Date(left.updatedAt).valueOf(),
      )
    },
  )
}
