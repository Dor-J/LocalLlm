import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ChatSidebar } from '~/components/ChatSidebar'
import { ConversationModeSelector } from '~/components/ConversationModeSelector'
import { CrewTemplateSelector } from '~/components/CrewTemplateSelector'
import { MessageComposer } from '~/components/MessageComposer'
import { MessageList } from '~/components/MessageList'
import { ModelSelector } from '~/components/ModelSelector'
import { OrchestrationTracePanel } from '~/components/OrchestrationTracePanel'
import {
  ChatHeader,
  ErrorBanner,
  RuntimeBanner,
  loadInitialChatState,
  resolveCrewTemplateId,
  useChatActions,
  useChatCapabilities,
  useChatDraft,
  useChatSessions,
  useOrchestrationRuns,
  useRuntimeHealth,
} from '~/features/chat'
import { queryClient } from '~/lib/query-client'

export const Route = createFileRoute('/')({
  loader: async () => loadInitialChatState(queryClient),
  component: ChatPage,
})

function ChatPage() {
  const initial = Route.useLoaderData()
  const sessionsDrawerId = useId()
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null)
  const chatsButtonRef = useRef<HTMLButtonElement>(null)

  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    () => initial.activeSessionId,
  )
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    () => initial.selectedRunId,
  )
  const [error, setError] = useState<string | null>(() => initial.error)
  const [sessionsDrawerOpen, setSessionsDrawerOpen] = useState(false)
  const [isNarrowViewport, setIsNarrowViewport] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia === 'undefined') {
      return
    }
    const media = window.matchMedia('(max-width: 980px)')
    const read = () => {
      setIsNarrowViewport(media.matches)
    }
    read()
    media.addEventListener('change', read)
    return () => media.removeEventListener('change', read)
  }, [])

  const closeSessionsDrawer = useCallback(() => {
    setSessionsDrawerOpen((open) => {
      if (open) {
        queueMicrotask(() => chatsButtonRef.current?.focus())
      }
      return false
    })
  }, [])

  const runtimeHealth = useRuntimeHealth(initial.health)
  const draft = useChatDraft(initial)
  const chatSessions = useChatSessions({ initial, activeSessionId })
  const orchestration = useOrchestrationRuns({
    initial,
    activeSessionId,
    selectedRunId,
  })

  const sessionConfigurationLocked = Boolean(
    activeSessionId && chatSessions.messages.length > 0,
  )
  const currentConversationMode =
    sessionConfigurationLocked && chatSessions.activeSession
      ? chatSessions.activeSession.conversationMode
      : draft.conversationMode
  const currentCrewTemplateId = resolveCrewTemplateId(
    currentConversationMode,
    sessionConfigurationLocked && chatSessions.activeSession
      ? chatSessions.activeSession.crewTemplateId
      : draft.crewTemplateId,
  )

  const capabilities = useChatCapabilities({
    health: runtimeHealth.health,
    selectedModel: draft.selectedModel,
    draftImages: draft.draftImages,
  })

  const focusComposer = useCallback(() => {
    queueMicrotask(() => {
      composerTextareaRef.current?.focus()
    })
  }, [])

  const actions = useChatActions({
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
    onSendSuccess: focusComposer,
  })

  const isSending = chatSessions.sendMessageMutation.isPending
  const title = chatSessions.activeSession?.title ?? 'New conversation'
  return (
    <main className="chat-shell">
      {sessionsDrawerOpen ? (
        <button
          aria-label="Close session list"
          className="chat-backdrop"
          onClick={closeSessionsDrawer}
          type="button"
        />
      ) : null}
      <ChatSidebar
        activeSessionId={activeSessionId}
        className={sessionsDrawerOpen ? 'sidebar--drawer-open' : undefined}
        id={sessionsDrawerId}
        inert={isNarrowViewport && !sessionsDrawerOpen ? true : undefined}
        onCreateSession={() => {
          actions.startNewChat()
          closeSessionsDrawer()
        }}
        onDeleteSession={(sessionId) => void actions.deleteSession(sessionId)}
        onSelectSession={(sessionId) => {
          void actions.loadSession(sessionId)
          closeSessionsDrawer()
        }}
        sessions={chatSessions.sessions}
      />

      <section aria-labelledby="chat-active-title" className="chat-panel">
        <div className="chat-panel__chrome">
          <ChatHeader
            ariaControls={sessionsDrawerId}
            chatsButtonRef={chatsButtonRef}
            drawerOpen={sessionsDrawerOpen}
            health={runtimeHealth.health}
            isRefreshing={runtimeHealth.isRefreshing}
            onChatsOpen={() => setSessionsDrawerOpen(true)}
            onRefresh={() => void actions.refreshHealth()}
            title={title}
          />
          <ErrorBanner message={error} />
          <RuntimeBanner message={capabilities.statusBanner} />
        </div>

        <div className="chat-panel__main">
          <MessageList
            isLoading={chatSessions.isLoadingSession || isSending}
            isLoadingSession={chatSessions.isLoadingSession}
            messages={chatSessions.messages}
          />

          {activeSessionId ? (
            <OrchestrationTracePanel
              error={orchestration.error}
              isExpanded={draft.tracePanelExpanded}
              isLoadingRun={orchestration.isLoadingRun}
              isLoadingRuns={orchestration.isLoadingRuns}
              onRefresh={() => void orchestration.refresh()}
              onSelectRun={setSelectedRunId}
              onToggleExpanded={() =>
                draft.setTracePanelExpanded(!draft.tracePanelExpanded)
              }
              runs={orchestration.runs}
              selectedRun={orchestration.selectedRun}
              selectedRunId={selectedRunId}
            />
          ) : null}
        </div>

        <footer className="chat-controls">
          <div className="chat-controls__top">
            <ModelSelector
              disabled={isSending}
              onChange={draft.setSelectedModel}
              selectedModel={draft.selectedModel}
            />
            <ConversationModeSelector
              disabled={isSending || sessionConfigurationLocked}
              mode={currentConversationMode}
              onChange={(mode) => {
                draft.setConversationMode(mode)
                if (mode === 'regular') {
                  draft.setCrewTemplateId(null)
                } else if (
                  mode === 'roleplay' &&
                  draft.crewTemplateId == null
                ) {
                  draft.setCrewTemplateId('roleplay-fantasy')
                } else if (mode === 'task' && draft.crewTemplateId == null) {
                  draft.setCrewTemplateId('research-assistant')
                }
              }}
            />
          </div>
          {sessionConfigurationLocked ? (
            <p className="chat-controls__session-lock" role="note">
              Session mode and template are fixed for this chat after the first
              message.
            </p>
          ) : null}

          <details
            aria-label="Advanced panels"
            className="chat-controls__advanced"
          >
            <summary className="chat-controls__advanced-summary">
              Advanced panels
            </summary>
            <div className="chat-controls__panel-toggles">
              <label
                className={`panel-toggle${
                  currentConversationMode === 'regular'
                    ? ' panel-toggle--disabled'
                    : ''
                }`}
                htmlFor="toggle-crew-template-panel"
              >
                <span
                  className="panel-toggle__text"
                  title="Pick a roleplay or task template when not in regular mode"
                >
                  Template panel
                </span>
                <span className="panel-toggle__track">
                  <input
                    checked={draft.showCrewTemplatePanel}
                    className="panel-toggle__input"
                    disabled={currentConversationMode === 'regular'}
                    id="toggle-crew-template-panel"
                    onChange={(event) =>
                      draft.setShowCrewTemplatePanel(event.target.checked)
                    }
                    title={
                      currentConversationMode === 'regular'
                        ? 'Switch to roleplay or task mode to use crew templates'
                        : undefined
                    }
                    type="checkbox"
                  />
                </span>
              </label>
            </div>
          </details>

          {draft.showCrewTemplatePanel ? (
            <CrewTemplateSelector
              disabled={isSending || sessionConfigurationLocked}
              mode={currentConversationMode}
              templateId={currentCrewTemplateId}
              onChange={draft.setCrewTemplateId}
            />
          ) : null}

          <MessageComposer
            ref={composerTextareaRef}
            allowImageUpload={capabilities.draftImagesAllowed}
            attachments={draft.draftImages}
            disabled={isSending || !capabilities.canSendMessages}
            disabledReason={capabilities.composerDisabledReason}
            draft={draft.draft}
            isUploadingImage={draft.isUploadingImage}
            onChange={draft.setDraft}
            onRemoveAttachment={(imageId) => void actions.removeImage(imageId)}
            onSubmit={() => void actions.sendMessage(draft.draft)}
            onUploadFile={(file) => void actions.uploadImage(file)}
          />
        </footer>
      </section>
    </main>
  )
}
