/**
 * Action bundle for the chat page: creating / loading / deleting sessions,
 * sending messages, uploading images, and refreshing health. These callbacks
 * intentionally live outside the individual hooks because they read/write
 * state across *all* of them; consolidating here keeps the route component
 * thin (P1-WEB-03).
 */

import type {
  ChatSessionSummary,
  ConversationMode,
  CrewTemplateId,
} from '@local/shared'
import { DEFAULT_CONVERSATION_MODE } from '@local/shared'
import { useQueryClient } from '@tanstack/react-query'
import { startTransition, useCallback } from 'react'
import { ApiError, api } from '~/lib/api'
import { chatKeys } from '~/lib/query-client'
import type { ChatCapabilities } from './capabilities'
import type { UseChatDraftResult } from './use-chat-draft'
import type { UseChatSessionsResult } from './use-chat-sessions'
import type { UseRuntimeHealthResult } from './use-runtime-health'
import {
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

  const sendMessage = useCallback(
    async (draftText: string) => {
      const content = draftText.trim()
      if (
        !content ||
        sendMessageMutation.isPending ||
        !capabilities.canSendMessages
      ) {
        return
      }
      const sessionId = await ensureSessionId()
      if (!sessionId) {
        return
      }
      setError(null)
      try {
        const response = await sendMessageMutation.mutateAsync({
          sessionId,
          payload: {
            content,
            selectedModel: draft.selectedModel,
            agentMode: currentConversationMode !== 'regular',
            roleplayEnabled: currentConversationMode === 'roleplay',
            imageAssetIds: draft.draftImages.map((image) => image.id),
            conversationMode: currentConversationMode,
            crewTemplateId: currentCrewTemplateId,
          },
        })
        draft.clearForSendSuccess()
        onSendSuccess?.()
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
      } catch (cause) {
        setError(getErrorMessage(cause))
        if (cause instanceof ApiError && cause.status >= 500) {
          await refreshHealth()
        }
      }
    },
    [
      capabilities.canSendMessages,
      currentConversationMode,
      currentCrewTemplateId,
      draft,
      ensureSessionId,
      onSendSuccess,
      refreshHealth,
      sendMessageMutation,
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
    loadSession,
    startNewChat,
    deleteSession,
    sendMessage,
    refreshHealth,
    uploadImage,
    removeImage,
  }
}
