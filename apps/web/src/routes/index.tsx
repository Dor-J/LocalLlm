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
import { cn } from '~/lib/cn'
import { queryClient } from '~/lib/query-client'
import {
  btnSecondary,
  chatPanelShell,
  drawerScrim,
  drawerSheetOpen,
  drawerSheetRight,
  elevatedAsideChrome,
  eyebrow as eyebrowClass,
  inspectorSectionShell,
  statusPillBase,
  statusPillOk,
  statusPillWarn,
} from '~/styles/ui'

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
  /** Wide layout: first column visibility (drawer uses `sessionsDrawerOpen`). */
  const [sidebarDesktopOpen, setSidebarDesktopOpen] = useState(true)
  /** Wide layout: third column visibility (drawer uses `inspectorDrawerOpen`). */
  const [inspectorDesktopOpen, setInspectorDesktopOpen] = useState(true)
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

  /** Narrow-only: closes the sessions drawer overlay. No-op on wide grid layout. */
  const closeSessionsPanel = useCallback(() => {
    const narrow =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 980px)').matches
    if (!narrow) {
      return
    }
    setSessionsDrawerOpen((open) => {
      if (open) {
        queueMicrotask(() => chatsButtonRef.current?.focus())
      }
      return false
    })
  }, [])

  const toggleSessionsPanel = useCallback(() => {
    const narrow =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 980px)').matches
    if (narrow) {
      setSessionsDrawerOpen((open) => !open)
    } else {
      setSidebarDesktopOpen((open) => !open)
    }
  }, [])

  const closeInspectorPanel = useCallback(() => {
    const narrow =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 980px)').matches
    if (narrow) {
      setInspectorDrawerOpen((open) => {
        if (open) {
          queueMicrotask(() => inspectorButtonRef.current?.focus())
        }
        return false
      })
    } else {
      setInspectorDesktopOpen((open) => {
        if (open) {
          queueMicrotask(() => inspectorButtonRef.current?.focus())
        }
        return false
      })
    }
  }, [])

  const openInspectorPanel = useCallback(() => {
    const narrow =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 980px)').matches
    if (narrow) {
      setInspectorDrawerOpen(true)
    } else {
      setInspectorDesktopOpen(true)
    }
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
        event.preventDefault()
        toggleSessionsPanel()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleSessionsPanel])

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

  const inspectorBackdropActive =
    isNarrowViewport && inspectorDrawerOpen

  const inspectorChromeOpen = isNarrowViewport
    ? inspectorDrawerOpen
    : inspectorDesktopOpen

  const sessionsBackdropActive =
    isNarrowViewport && sessionsDrawerOpen

  const chatsChromeOpen = isNarrowViewport
    ? sessionsDrawerOpen
    : sidebarDesktopOpen

  const showDesktopChatsButton =
    !isNarrowViewport &&
    (!sidebarDesktopOpen ||
      (!inspectorDesktopOpen && sidebarDesktopOpen))
  const showDesktopInspectorButton =
    !isNarrowViewport && !inspectorDesktopOpen

  const desktopGridCols = isNarrowViewport
    ? ''
    : !sidebarDesktopOpen && !inspectorDesktopOpen
      ? 'min-[981px]:grid-cols-[minmax(0,1fr)]'
      : !sidebarDesktopOpen
        ? 'min-[981px]:grid-cols-[minmax(0,1fr)_340px]'
        : !inspectorDesktopOpen
          ? 'min-[981px]:grid-cols-[300px_minmax(0,1fr)]'
          : 'min-[981px]:grid-cols-[300px_minmax(0,1fr)_340px]'

  return (
    <main
      className={cn(
        'h-[100dvh] gap-3 overflow-hidden p-3',
        isNarrowViewport ? 'block' : 'grid min-[981px]:grid min-[981px]:grid-rows-1',
        desktopGridCols,
      )}
    >
      {sessionsBackdropActive || inspectorBackdropActive ? (
        <button
          aria-label="Close open drawer"
          className={drawerScrim}
          onClick={() => {
            closeSessionsPanel()
            closeInspectorPanel()
          }}
          type="button"
        />
      ) : null}
      <ChatSidebar
        activeSessionId={activeSessionId}
        drawerOpen={sessionsDrawerOpen}
        hideOnDesktop={!isNarrowViewport && !sidebarDesktopOpen}
        id={sessionsDrawerId}
        inert={isNarrowViewport && !sessionsDrawerOpen ? true : undefined}
        onCreateSession={() => {
          actions.startNewChat()
          closeSessionsPanel()
        }}
        onDeleteSession={(sessionId) => void actions.deleteSession(sessionId)}
        onSelectSession={(sessionId) => {
          void actions.loadSession(sessionId)
          closeSessionsPanel()
        }}
        sessions={chatSessions.sessions}
      />

      <section aria-labelledby="chat-active-title" className={chatPanelShell}>
        <div className="flex shrink-0 flex-col gap-3">
          <ChatHeader
            ariaControls={sessionsDrawerId}
            chatsButtonRef={chatsButtonRef}
            drawerOpen={chatsChromeOpen}
            health={runtimeHealth.health}
            isRefreshing={runtimeHealth.isRefreshing}
            onChatsOpen={toggleSessionsPanel}
            onInspectorOpen={openInspectorPanel}
            onRefresh={() => void actions.refreshHealth()}
            inspectorOpen={inspectorChromeOpen}
            inspectorButtonRef={inspectorButtonRef}
            inspectorControls={inspectorDrawerId}
            showDesktopChatsButton={showDesktopChatsButton}
            showDesktopInspectorButton={showDesktopInspectorButton}
            title={title}
          />
          {liveRegion}
          <ErrorBanner message={error} />
          <RuntimeBanner message={capabilities.statusBanner} />
        </div>

        <div className="flex min-h-0 flex-[1_1_0] flex-col gap-3">
          <MessageList
            isLoading={chatSessions.isLoadingSession || isSending}
            isLoadingSession={chatSessions.isLoadingSession}
            messages={chatSessions.messages}
          />
        </div>

        <footer className="flex flex-col gap-[0.65rem]">
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
        className={cn(
          elevatedAsideChrome,
          'gap-0',
          drawerSheetRight,
          inspectorDrawerOpen && drawerSheetOpen,
          !isNarrowViewport && !inspectorDesktopOpen && 'min-[981px]:hidden',
        )}
        id={inspectorDrawerId}
        inert={isNarrowViewport && !inspectorDrawerOpen ? true : undefined}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 pb-[0.85rem]">
          <div>
            <p className={eyebrowClass}>Workbench</p>
            <h2>Inspector</h2>
          </div>
          <button
            className={cn(btnSecondary, 'inline-flex')}
            onClick={(event) => {
              event.stopPropagation()
              closeInspectorPanel()
            }}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-[1_1_0] flex-col gap-[0.85rem] overflow-x-hidden overflow-y-auto">
        <section className={inspectorSectionShell}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="m-0">Runtime</h3>
            <button
              className={btnSecondary}
              disabled={runtimeHealth.isRefreshing}
              onClick={() => void actions.refreshHealth()}
              type="button"
            >
              {runtimeHealth.isRefreshing ? 'Checking...' : 'Refresh'}
            </button>
          </div>
          <div className="flex flex-wrap items-start justify-start gap-3">
            <span
              className={cn(
                statusPillBase,
                runtimeHealth.health?.status === 'ok'
                  ? statusPillOk
                  : statusPillWarn,
              )}
            >
              {runtimeHealth.health
                ? `API ${runtimeHealth.health.status}`
                : 'API unavailable'}
            </span>
            <span
              className={cn(
                statusPillBase,
                runtimeHealth.health?.ollama.ready
                  ? statusPillOk
                  : statusPillWarn,
              )}
            >
              {runtimeHealth.health?.ollama.ready
                ? 'Ollama online'
                : 'Ollama offline'}
            </span>
            <span className={statusPillBase}>PostgreSQL + pgvector</span>
          </div>
        </section>

        <section className={inspectorSectionShell}>
          <h3 className="m-0">Chat Settings</h3>
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
            <p
              className="m-0 text-[0.86rem] leading-[1.45] text-[var(--text-muted)]"
              role="note"
            >
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
        </div>
      </aside>

      <KeyboardShortcutsDialog
        onClose={() => setShortcutsDialogOpen(false)}
        open={shortcutsDialogOpen}
      />
    </main>
  )
}
