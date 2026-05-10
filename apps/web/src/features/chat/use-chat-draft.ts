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
import { useCallback, useState } from 'react'
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

export function useChatDraft(initial: InitialChatState): UseChatDraftResult {
  const [draft, setDraft] = useState('')
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
    setDraft('')
    setDraftImages([])
    setConversationMode(DEFAULT_CONVERSATION_MODE)
    setCrewTemplateId(null)
  }, [])

  const clearForSendSuccess = useCallback(() => {
    setDraft('')
    setDraftImages([])
  }, [])

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
