/**
 * Presentational header for the chat panel: title + runtime status pills +
 * refresh button. Purely derived from props so it is trivial to snapshot and
 * reuse (P1-WEB-03).
 */

import type { HealthResponse } from '@local/shared'
import type { Ref } from 'react'

export interface ChatHeaderProps {
  title: string
  health: HealthResponse | null
  isRefreshing: boolean
  onRefresh: () => void
  /** Shown on narrow viewports to open the session list drawer. */
  onChatsOpen?: () => void
  chatsButtonRef?: Ref<HTMLButtonElement>
  /** Element id of the session list panel (for `aria-controls`). */
  ariaControls?: string
  /** Whether the session drawer is open (for `aria-expanded`). */
  drawerOpen?: boolean
}

export function ChatHeader({
  title,
  health,
  isRefreshing,
  onRefresh,
  onChatsOpen,
  chatsButtonRef,
  ariaControls,
  drawerOpen = false,
}: ChatHeaderProps) {
  return (
    <header className="chat-panel__header">
      {onChatsOpen ? (
        <button
          aria-controls={ariaControls}
          aria-expanded={drawerOpen}
          className="secondary-button chat-header__chats"
          onClick={onChatsOpen}
          ref={chatsButtonRef}
          type="button"
        >
          Chats
        </button>
      ) : null}
      <div className="chat-panel__header-title">
        <p className="eyebrow">Ollama-backed chat runtime</p>
        <h2 id="chat-active-title">{title}</h2>
      </div>

      <div className="status-cluster">
        <span
          className={`status-pill ${
            health?.status === 'ok' ? 'status-pill--ok' : 'status-pill--warn'
          }`}
        >
          {health ? `API ${health.status}` : 'API unavailable'}
        </span>
        <span className="status-pill">PostgreSQL + pgvector</span>
        <span
          className={`status-pill ${
            health?.ollama.ready ? 'status-pill--ok' : 'status-pill--warn'
          }`}
        >
          {health?.ollama.ready ? 'Ollama online' : 'Ollama offline'}
        </span>
        <button
          className="secondary-button"
          disabled={isRefreshingHealthDisabled(isRefreshing)}
          onClick={onRefresh}
          type="button"
        >
          {isRefreshing ? 'Checking...' : 'Refresh runtime'}
        </button>
      </div>
    </header>
  )
}

/**
 * Small helper named so the disabled predicate is obvious at call sites.
 * Kept local because no other component needs it.
 */
function isRefreshingHealthDisabled(isRefreshing: boolean): boolean {
  return isRefreshing
}
