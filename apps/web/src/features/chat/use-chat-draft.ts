/**
 * Hook owning all draft-related UI state: composer text, selected model,
 * conversation mode, crew template, image attachments, and persisted footer
 * panel visibility. Keeps the chat page lean (P1-WEB-03).
 */

import type {
  ChatModel,
  ConversationMode,
  CrewTemplateId,
  ImageAssetSummary,
} from '@local/shared'
import { DEFAULT_CONVERSATION_MODE } from '@local/shared'
import {
  readChatPanelVisibilityPrefs,
  writeChatPanelVisibilityPrefs,
} from '~/lib/chat-panel-visibility-prefs'
import { readChatDraft, writeChatDraft } from '~/lib/chat-draft-storage'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { InitialChatState } from './initial-state'

export interface UseChatDraftResult {
  draft: string
  setDraft: (next: string) => void
  selectedModel: ChatModel
  setSelectedModel: (next: ChatModel) => void
  conversationMode: ConversationMode
  setConversationMode: (next: ConversationMode) => void
  crewTemplateId: CrewTemplateId | null
  setCrewTemplateId: (next: CrewTemplateId | null) => void
  draftImages: ImageAssetSummary[]
  setDraftImages: React.Dispatch<React.SetStateAction<ImageAssetSummary[]>>
  showCrewTemplatePanel: boolean
  setShowCrewTemplatePanel: (next: boolean) => void
  tracePanelExpanded: boolean
  setTracePanelExpanded: (next: boolean) => void
  isUploadingImage: boolean
  setIsUploadingImage: (next: boolean) => void
  reset: () => void
  clearForSendSuccess: () => void
}

export function useChatDraft(
  initial: InitialChatState,
  activeSessionId: string | null,
): UseChatDraftResult {
  const [draft, setDraftState] = useState(() => readChatDraft(activeSessionId))
  const [selectedModel, setSelectedModel] = useState<ChatModel>(
    initial.selectedModel,
  )
  const [conversationMode, setConversationMode] = useState<ConversationMode>(
    initial.conversationMode,
  )
  const [crewTemplateId, setCrewTemplateId] = useState<CrewTemplateId | null>(
    () => initial.crewTemplateId,
  )
  const [draftImages, setDraftImages] = useState<ImageAssetSummary[]>([])
  const [panelVisibility, setPanelVisibility] = useState(() =>
    readChatPanelVisibilityPrefs(),
  )
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const didMountRef = useRef(false)

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    setDraftState(readChatDraft(activeSessionId))
  }, [activeSessionId])

  const setDraft = useCallback(
    (next: string) => {
      setDraftState(next)
      writeChatDraft(activeSessionId, next)
    },
    [activeSessionId],
  )

  const setShowCrewTemplatePanel = useCallback(
    (showCrewTemplatePanel: boolean) => {
      setPanelVisibility((prev) => {
        const next = { ...prev, showCrewTemplatePanel }
        writeChatPanelVisibilityPrefs(next)
        return next
      })
    },
    [],
  )

  const setTracePanelExpanded = useCallback((tracePanelExpanded: boolean) => {
    setPanelVisibility((prev) => {
      const next = { ...prev, tracePanelExpanded }
      writeChatPanelVisibilityPrefs(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setDraftState('')
    writeChatDraft(activeSessionId, '')
    setDraftImages([])
    setConversationMode(DEFAULT_CONVERSATION_MODE)
    setCrewTemplateId(null)
  }, [activeSessionId])

  const clearForSendSuccess = useCallback(() => {
    setDraftState('')
    writeChatDraft(activeSessionId, '')
    setDraftImages([])
  }, [activeSessionId])

  return {
    draft,
    setDraft,
    selectedModel,
    setSelectedModel,
    conversationMode,
    setConversationMode,
    crewTemplateId,
    setCrewTemplateId,
    draftImages,
    setDraftImages,
    showCrewTemplatePanel: panelVisibility.showCrewTemplatePanel,
    setShowCrewTemplatePanel,
    tracePanelExpanded: panelVisibility.tracePanelExpanded,
    setTracePanelExpanded,
    isUploadingImage,
    setIsUploadingImage,
    reset,
    clearForSendSuccess,
  }
}
