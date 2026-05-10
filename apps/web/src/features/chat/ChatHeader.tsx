/**
 * Presentational header for the chat panel: title + runtime status pills +
 * refresh button. Purely derived from props so it is trivial to snapshot and
 * reuse (P1-WEB-03).
 */

import type { HealthResponse } from '@local/shared'
import { Menu, RefreshCw, SlidersHorizontal } from 'lucide-react'
import type { Ref } from 'react'
import { cn } from '~/lib/cn'
import {
  btnIcon,
  eyebrow as eyebrowClass,
  statusPillBase,
  statusPillOk,
  statusPillWarn,
} from '~/styles/ui'

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
  /**
   * Wide layout (&gt;980px): show Chats toggle when the sidebar column is
   * collapsed or when the inspector column is collapsed with sidebar visible.
   */
  showDesktopChatsButton: boolean
  /** Wide layout: show Inspector toggle when the inspector column is collapsed. */
  showDesktopInspectorButton: boolean
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
  showDesktopChatsButton,
  showDesktopInspectorButton,
}: ChatHeaderProps) {
  return (
    <header className="flex flex-wrap items-start gap-x-3 gap-y-[0.6rem]">
      {onChatsOpen ? (
        <button
          aria-controls={ariaControls}
          aria-expanded={drawerOpen}
          className={cn(
            btnIcon,
            'hidden max-[980px]:inline-grid',
            showDesktopChatsButton && 'min-[981px]:inline-grid',
          )}
          onClick={onChatsOpen}
          ref={chatsButtonRef}
          type="button"
          title="Chats"
        >
          <Menu aria-hidden size={18} />
          <span className="sr-only">Chats</span>
        </button>
      ) : null}
      <div className="min-w-[12rem] flex-[1_1_0]">
        <p className={eyebrowClass}>Ollama-backed chat runtime</p>
        <h2 id="chat-active-title">{title}</h2>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span
          className={cn(
            statusPillBase,
            health?.status === 'ok' ? statusPillOk : statusPillWarn,
          )}
        >
          {health ? `API ${health.status}` : 'API unavailable'}
        </span>
        <span className={statusPillBase}>PostgreSQL + pgvector</span>
        <span
          className={cn(
            statusPillBase,
            health?.ollama.ready ? statusPillOk : statusPillWarn,
          )}
        >
          {health?.ollama.ready ? 'Ollama online' : 'Ollama offline'}
        </span>
        <button
          aria-label={isRefreshing ? 'Checking runtime' : 'Refresh runtime'}
          className={btnIcon}
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
            className={cn(
              btnIcon,
              'hidden max-[980px]:inline-grid',
              showDesktopInspectorButton && 'min-[981px]:inline-grid',
            )}
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
