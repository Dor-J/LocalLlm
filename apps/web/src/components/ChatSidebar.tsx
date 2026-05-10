import type { ChatSessionSummary } from '@local/shared'
import { Link } from '@tanstack/react-router'
import { MessageSquarePlus, Theater, Trash2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { ConfirmDeleteSessionDialog } from '~/components/ConfirmDeleteSessionDialog'
import { cn } from '~/lib/cn'
import { formatDateTime } from '~/lib/format'
import {
  btnIcon,
  btnPrimary,
  btnSecondary,
  drawerSheetLeft,
  drawerSheetOpen,
  elevatedAsideChrome,
  eyebrow as eyebrowClass,
  surfaceSelectedStrong,
} from '~/styles/ui'

interface ChatSidebarProps {
  activeSessionId: string | null
  onCreateSession: () => void
  onDeleteSession: (sessionId: string) => void
  onSelectSession: (sessionId: string) => void
  sessions: ChatSessionSummary[]
  /** Narrow viewport: drawer visibility (slide-over sessions rail). */
  drawerOpen?: boolean
  /** Wide viewport: hide column when sidebar is collapsed. */
  hideOnDesktop?: boolean
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
  drawerOpen = false,
  hideOnDesktop = false,
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
        className={cn(
          elevatedAsideChrome,
          'gap-[0.85rem]',
          drawerSheetLeft,
          drawerOpen && drawerSheetOpen,
          hideOnDesktop && 'min-[981px]:hidden',
          className,
        )}
        id={id}
        inert={inert}
      >
        <div className="flex flex-col items-stretch gap-[0.65rem]">
          <div>
            <p className={eyebrowClass}>Local-first AI</p>
            <h1>Chats</h1>
          </div>
          <div className="flex flex-col items-stretch gap-2">
            <Link className={cn(btnSecondary, 'justify-center')} to="/roleplays">
              <Theater aria-hidden size={16} />
              Roleplays
            </Link>
            <button
              className={cn(btnPrimary, 'justify-center')}
              onClick={onCreateSession}
              type="button"
            >
              <MessageSquarePlus aria-hidden size={16} />
              New Chat
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-[0.6rem] overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="grid min-h-[200px] place-items-center px-1 py-2 text-center text-[var(--text-muted)]">
              <div className="max-w-[var(--prose-max-width)]">
                <p className="mb-[0.4rem] text-[length:var(--text-xs)] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Your chats
                </p>
                <h2 className="mb-2 text-[length:var(--text-md)] font-semibold text-[var(--text)]">
                  No saved conversations yet
                </h2>
                <p className="m-0 text-[length:var(--text-base)] leading-[1.55]">
                  Start a new chat — sessions are stored locally via the API so you
                  can pick up later.
                </p>
              </div>
            </div>
          ) : null}

          {sessions.map((session) => {
            const isActive = activeSessionId === session.id
            return (
              <div
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-[10px] border border-[color:var(--border)] bg-[var(--bg-panel)] text-inherit',
                  isActive && surfaceSelectedStrong,
                )}
                key={session.id}
              >
                <button
                  className="block min-w-0 flex-[1_1_0] cursor-pointer rounded-bl-[10px] rounded-tl-[10px] border-0 bg-transparent py-3 pl-[0.8rem] pr-1 text-left font-inherit text-inherit"
                  onClick={() => onSelectSession(session.id)}
                  type="button"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-semibold">
                      {session.title ?? 'Untitled conversation'}
                    </span>
                    <span className="inline-flex w-fit items-center rounded-full border border-[color:var(--border)] bg-[rgba(81,97,126,0.12)] px-2 py-[0.16rem] text-[length:var(--text-sm)] text-[var(--text-muted)]">
                      {formatConversationMode(session.conversationMode)}
                    </span>
                    <span className="text-[length:var(--text-sm)] text-[var(--text-muted)]">
                      {formatDateTime(session.updatedAt)}
                    </span>
                  </div>
                </button>
                <button
                  aria-label={`Delete ${session.title ?? 'conversation'}`}
                  className={cn(
                    btnIcon,
                    'mr-2 transition-colors duration-[120ms] ease-in hover:text-[var(--danger)]',
                  )}
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
