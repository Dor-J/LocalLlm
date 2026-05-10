/**
 * Presentational header for the chat panel: title + runtime status pills +
 * refresh button. Purely derived from props so it is trivial to snapshot and
 * reuse (P1-WEB-03).
 */

import type { HealthResponse } from '@local/shared'
import { Menu, RefreshCw, SlidersHorizontal } from 'lucide-react'
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
  onInspectorOpen?: () => void
  inspectorOpen?: boolean
  inspectorButtonRef?: Ref<HTMLButtonElement>
  inspectorControls?: string
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
  onInspectorOpen,
  inspectorOpen = false,
  inspectorButtonRef,
  inspectorControls,
}: ChatHeaderProps) {
  return (
    <header className="chat-panel__header">
      {onChatsOpen ? (
        <button
          aria-controls={ariaControls}
          aria-expanded={drawerOpen}
          className="icon-button chat-header__chats"
          onClick={onChatsOpen}
          ref={chatsButtonRef}
          type="button"
          title="Chats"
        >
          <Menu aria-hidden size={18} />
          <span className="visually-hidden">Chats</span>
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
          aria-label={isRefreshing ? 'Checking runtime' : 'Refresh runtime'}
          className="icon-button"
          disabled={isRefreshingHealthDisabled(isRefreshing)}
          onClick={onRefresh}
          title={isRefreshing ? 'Checking...' : 'Refresh runtime'}
          type="button"
        >
          <RefreshCw aria-hidden size={17} />
        </button>
        {onInspectorOpen ? (
          <button
            aria-controls={inspectorControls}
            aria-expanded={inspectorOpen}
            aria-label="Open chat inspector"
            className="icon-button chat-header__inspector"
            onClick={onInspectorOpen}
            ref={inspectorButtonRef}
            title="Inspector"
            type="button"
          >
            <SlidersHorizontal aria-hidden size={18} />
          </button>
        ) : null}
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
