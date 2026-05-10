import type { ChatSessionSummary } from '@local/shared'
import { Link } from '@tanstack/react-router'
import { MessageSquarePlus, Theater, Trash2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { ConfirmDeleteSessionDialog } from '~/components/ConfirmDeleteSessionDialog'
import { formatDateTime } from '~/lib/format'

interface ChatSidebarProps {
  activeSessionId: string | null
  onCreateSession: () => void
  onDeleteSession: (sessionId: string) => void
  onSelectSession: (sessionId: string) => void
  sessions: ChatSessionSummary[]
  className?: string
  id?: string
  /** When set, used as the accessible name for the session list region. */
  'aria-label'?: string
  /** When true, the panel is removed from the tab order and interaction. */
  inert?: boolean
}

export function ChatSidebar({
  activeSessionId,
  onCreateSession,
  onDeleteSession,
  onSelectSession,
  sessions,
  className,
  id,
  'aria-label': ariaLabel = 'Chat sessions',
  inert,
}: ChatSidebarProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const focusBeforeDialogRef = useRef<Element | null>(null)

  const pendingSessionTitle =
    pendingDeleteId === null
      ? null
      : (sessions.find((s) => s.id === pendingDeleteId)?.title?.trim() ||
          'Untitled conversation')

  const requestDelete = useCallback((sessionId: string) => {
    focusBeforeDialogRef.current = document.activeElement
    setPendingDeleteId(sessionId)
  }, [])

  const closeDialog = useCallback(() => {
    setPendingDeleteId(null)
    queueMicrotask(() => {
      const el = focusBeforeDialogRef.current
      if (el instanceof HTMLElement) {
        el.focus()
      }
      focusBeforeDialogRef.current = null
    })
  }, [])

  const confirmDelete = useCallback(() => {
    if (pendingDeleteId !== null) {
      onDeleteSession(pendingDeleteId)
    }
    closeDialog()
  }, [closeDialog, onDeleteSession, pendingDeleteId])

  return (
    <>
    <aside
      aria-label={ariaLabel}
      className={className ? `sidebar ${className}` : 'sidebar'}
      id={id}
      inert={inert}
    >
      <div className="sidebar__header">
        <div>
          <p className="eyebrow">Local-first AI</p>
          <h1>Chats</h1>
        </div>
        <div className="sidebar__actions">
          <Link className="secondary-button" to="/roleplays">
            <Theater aria-hidden size={16} />
            Roleplays
          </Link>
          <button
            className="primary-button"
            onClick={onCreateSession}
            type="button"
          >
            <MessageSquarePlus aria-hidden size={16} />
            New Chat
          </button>
        </div>
      </div>

      <div className="sidebar__list">
        {sessions.length === 0 ? (
          <div className="empty-state empty-state--sidebar">
            <p className="empty-state__eyebrow">Your chats</p>
            <h2 className="empty-state__title">No saved conversations yet</h2>
            <p className="empty-state__body">
              Start a new chat — sessions are stored locally via the API so you
              can pick up later.
            </p>
          </div>
        ) : null}

        {sessions.map((session) => {
          const isActive = activeSessionId === session.id
          return (
            <div
              className={`conversation-card ${
                isActive ? 'conversation-card--active' : ''
              }`}
              key={session.id}
            >
              <button
                className="conversation-card__select"
                onClick={() => onSelectSession(session.id)}
                type="button"
              >
                <div className="conversation-card__content">
                  <span className="conversation-card__title">
                    {session.title ?? 'Untitled conversation'}
                  </span>
                  <span className="conversation-card__mode">
                    {formatConversationMode(session.conversationMode)}
                  </span>
                  <span className="conversation-card__date">
                    {formatDateTime(session.updatedAt)}
                  </span>
                </div>
              </button>
              <button
                aria-label={`Delete ${session.title ?? 'conversation'}`}
                className="icon-button conversation-card__delete"
                onClick={() => requestDelete(session.id)}
                title="Delete conversation"
                type="button"
              >
                <Trash2 aria-hidden size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </aside>
    <ConfirmDeleteSessionDialog
      onCancel={closeDialog}
      onConfirm={confirmDelete}
      sessionTitle={pendingSessionTitle}
    />
    </>
  )
}

function formatConversationMode(mode: ChatSessionSummary['conversationMode']) {
  switch (mode) {
    case 'roleplay':
      return 'Roleplay'
    case 'task':
      return 'Task'
    default:
      return 'Regular'
  }
}
