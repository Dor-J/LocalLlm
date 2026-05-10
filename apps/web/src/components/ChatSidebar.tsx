import type { ChatSessionSummary } from '@local/shared'
import { Link } from '@tanstack/react-router'
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
  return (
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
            Roleplays
          </Link>
          <button
            className="primary-button"
            onClick={onCreateSession}
            type="button"
          >
            New Chat
          </button>
        </div>
      </div>

      <div className="sidebar__list">
        {sessions.length === 0 ? (
          <div className="empty-state">
            <p>No saved conversations yet.</p>
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
                className="conversation-card__delete"
                onClick={() => onDeleteSession(session.id)}
                type="button"
              >
                Delete
              </button>
            </div>
          )
        })}
      </div>
    </aside>
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
