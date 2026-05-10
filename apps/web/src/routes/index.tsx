import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ChatSidebar } from '~/components/ChatSidebar'
import { ConversationModeSelector } from '~/components/ConversationModeSelector'
import { CrewTemplateSelector } from '~/components/CrewTemplateSelector'
import { KeyboardShortcutsDialog } from '~/components/KeyboardShortcutsDialog'
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
  useChatLiveAnnouncements,
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
  const inspectorDrawerId = useId()
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null)
  const chatsButtonRef = useRef<HTMLButtonElement>(null)
  const inspectorButtonRef = useRef<HTMLButtonElement>(null)

  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    () => initial.activeSessionId,
  )
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    () => initial.selectedRunId,
  )
  const [error, setError] = useState<string | null>(() => initial.error)
  const [sessionsDrawerOpen, setSessionsDrawerOpen] = useState(false)
  const [inspectorDrawerOpen, setInspectorDrawerOpen] = useState(false)
  const [isNarrowViewport, setIsNarrowViewport] = useState(false)
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false)

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

  const closeInspectorDrawer = useCallback(() => {
    setInspectorDrawerOpen((open) => {
      if (open) {
        queueMicrotask(() => inspectorButtonRef.current?.focus())
      }
      return false
    })
  }, [])

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false
      }
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return true
      }
      return target.isContentEditable
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return
      }
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key === '/') {
        event.preventDefault()
        setShortcutsDialogOpen(true)
        return
      }
      if (mod && event.key === '.') {
        event.preventDefault()
        composerTextareaRef.current?.focus()
        return
      }
      if (mod && event.shiftKey && (event.key === 'c' || event.key === 'C')) {
        if (isNarrowViewport) {
          event.preventDefault()
          setSessionsDrawerOpen(true)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isNarrowViewport])

  const runtimeHealth = useRuntimeHealth(initial.health)
  const draft = useChatDraft(initial, activeSessionId)
  const chatSessions = useChatSessions({ initial, activeSessionId })
  const [isStreamingMessage, setIsStreamingMessage] = useState(false)
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

  const isSending =
    chatSessions.sendMessageMutation.isPending || isStreamingMessage

  const { liveRegion } = useChatLiveAnnouncements({
    error,
    isSending,
    messages: chatSessions.messages,
  })

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
    isStreamingMessage,
    setIsStreamingMessage,
    onSendSuccess: focusComposer,
  })

  const title = chatSessions.activeSession?.title ?? 'New conversation'

  return (
    <main className="chat-shell">
      {sessionsDrawerOpen || inspectorDrawerOpen ? (
        <button
          aria-label="Close open drawer"
          className="chat-backdrop"
          onClick={() => {
            closeSessionsDrawer()
            closeInspectorDrawer()
          }}
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
            onInspectorOpen={() => setInspectorDrawerOpen(true)}
            onRefresh={() => void actions.refreshHealth()}
            inspectorOpen={inspectorDrawerOpen}
            inspectorButtonRef={inspectorButtonRef}
            inspectorControls={inspectorDrawerId}
            title={title}
          />
          {liveRegion}
          <ErrorBanner message={error} />
          <RuntimeBanner message={capabilities.statusBanner} />
        </div>

        <div className="chat-panel__main">
          <MessageList
            isLoading={chatSessions.isLoadingSession || isSending}
            isLoadingSession={chatSessions.isLoadingSession}
            messages={chatSessions.messages}
          />
        </div>

        <footer className="chat-controls">
          <MessageComposer
            ref={composerTextareaRef}
            allowImageUpload={capabilities.draftImagesAllowed}
            attachments={draft.draftImages}
            disabled={isSending || !capabilities.canSendMessages}
            disabledReason={capabilities.composerDisabledReason}
            draft={draft.draft}
            isUploadingImage={draft.isUploadingImage}
            onChange={draft.setDraft}
            onClear={() => draft.setDraft('')}
            onRemoveAttachment={(imageId) => void actions.removeImage(imageId)}
            onSubmit={(value) => void actions.sendMessage(value)}
            onUploadFile={(file) => void actions.uploadImage(file)}
          />
        </footer>
      </section>

      <aside
        aria-label="Chat inspector"
        className={`chat-inspector ${
          inspectorDrawerOpen ? 'chat-inspector--drawer-open' : ''
        }`}
        id={inspectorDrawerId}
        inert={isNarrowViewport && !inspectorDrawerOpen ? true : undefined}
      >
        <div className="chat-inspector__header">
          <div>
            <p className="eyebrow">Workbench</p>
            <h2>Inspector</h2>
          </div>
          <button
            className="secondary-button chat-inspector__close"
            onClick={closeInspectorDrawer}
            type="button"
          >
            Close
          </button>
        </div>

        <section className="inspector-section">
          <div className="inspector-section__header">
            <h3>Runtime</h3>
            <button
              className="secondary-button"
              disabled={runtimeHealth.isRefreshing}
              onClick={() => void actions.refreshHealth()}
              type="button"
            >
              {runtimeHealth.isRefreshing ? 'Checking...' : 'Refresh'}
            </button>
          </div>
          <div className="status-stack">
            <span
              className={`status-pill ${
                runtimeHealth.health?.status === 'ok'
                  ? 'status-pill--ok'
                  : 'status-pill--warn'
              }`}
            >
              {runtimeHealth.health
                ? `API ${runtimeHealth.health.status}`
                : 'API unavailable'}
            </span>
            <span
              className={`status-pill ${
                runtimeHealth.health?.ollama.ready
                  ? 'status-pill--ok'
                  : 'status-pill--warn'
              }`}
            >
              {runtimeHealth.health?.ollama.ready
                ? 'Ollama online'
                : 'Ollama offline'}
            </span>
            <span className="status-pill">PostgreSQL + pgvector</span>
          </div>
        </section>

        <section className="inspector-section">
          <h3>Chat Settings</h3>
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
              } else if (mode === 'roleplay' && draft.crewTemplateId == null) {
                draft.setCrewTemplateId('roleplay-fantasy')
              } else if (mode === 'task' && draft.crewTemplateId == null) {
                draft.setCrewTemplateId('research-assistant')
              }
            }}
          />
          {sessionConfigurationLocked ? (
            <p className="chat-controls__session-lock" role="note">
              Session mode and template are fixed after the first message.
            </p>
          ) : null}
          {currentConversationMode !== 'regular' ? (
            <CrewTemplateSelector
              disabled={isSending || sessionConfigurationLocked}
              mode={currentConversationMode}
              templateId={currentCrewTemplateId}
              onChange={draft.setCrewTemplateId}
            />
          ) : null}
        </section>

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
      </aside>

      <KeyboardShortcutsDialog
        onClose={() => setShortcutsDialogOpen(false)}
        open={shortcutsDialogOpen}
      />
    </main>
  )
}
