import type { ChatMessage } from '@local/shared'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef, useState } from 'react'
import { MessageMarkdown } from '~/components/MessageMarkdown'
import { formatElapsedMinuteSeconds, formatTime } from '~/lib/format'
import { cn } from '~/lib/cn'

/**
 * Props for the scrollable message column (empty state, loading, or conversation).
 */
export interface MessageListProps {
  /** True while the assistant is generating or send is in flight. */
  isLoading: boolean
  /** True while the active session's messages are being fetched from the server. */
  isLoadingSession?: boolean
  messages: ChatMessage[]
}

type OptimisticStatus = 'pending' | 'streaming' | 'failed'

const MESSAGE_VIRTUAL_THRESHOLD = 100

const bubbleShell =
  'max-w-[min(780px,92%)] rounded-xl border border-[color:var(--border)] bg-[var(--bg-panel)] px-[0.95rem] py-[0.85rem] text-[length:var(--text-base)] max-[980px]:max-w-full'

/**
 * Extract the optimistic `clientStatus` marker written into the message
 * metadata by `sendMessageMutation.onMutate` / `onError` (P1-WEB-02).
 * Persisted server messages never carry this key.
 */
function getOptimisticStatus(message: ChatMessage): OptimisticStatus | null {
  const raw = message.metadata?.clientStatus
  if (raw === 'pending' || raw === 'streaming' || raw === 'failed') {
    return raw
  }
  return null
}

/** Drops holes or malformed rows so list render never reads ``undefined.id``. */
function filterRenderableMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter(
    (m): m is ChatMessage =>
      m != null &&
      typeof m === 'object' &&
      typeof m.id === 'string' &&
      m.id.length > 0,
  )
}

/**
 * Wall-clock time for finished messages; live `m:ss` elapsed while streaming
 * so the meta row does not look frozen during token delivery.
 */
function MessageMetaTime({
  createdAt,
  optimisticStatus,
}: {
  createdAt: string
  optimisticStatus: OptimisticStatus | null
}) {
  const isStreaming = optimisticStatus === 'streaming'
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!isStreaming) {
      return
    }
    const id = window.setInterval(() => {
      setTick((n) => n + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [isStreaming])

  const startMs = new Date(createdAt).getTime()
  const elapsedSec =
    Number.isFinite(startMs) && startMs > 0
      ? Math.max(0, (Date.now() - startMs) / 1000)
      : 0

  if (isStreaming) {
    return (
      <time dateTime={createdAt} title={`Started ${formatTime(createdAt)}`}>
        {formatElapsedMinuteSeconds(elapsedSec)}
      </time>
    )
  }

  return <time dateTime={createdAt}>{formatTime(createdAt)}</time>
}

function MessageBody({
  role,
  content,
  optimisticStatus,
}: {
  role: ChatMessage['role']
  content: string
  optimisticStatus: OptimisticStatus | null
}) {
  const plainClass = 'm-0 max-w-[var(--prose-max-width)] whitespace-pre-wrap leading-[1.65]'
  if (role === 'assistant') {
    if (!content.trim() && optimisticStatus === 'streaming') {
      return <p className={plainClass}>Starting response...</p>
    }
    if (!content) {
      return <p className={plainClass} />
    }
    return <MessageMarkdown content={content} />
  }

  return <p className={plainClass}>{content}</p>
}

function MessageArticle({ message }: { message: ChatMessage }) {
  const optimisticStatus = getOptimisticStatus(message)

  return (
    <article
      className={cn(
        bubbleShell,
        message.role === 'user' &&
          'ml-auto border-[rgba(126,215,193,0.32)] bg-gradient-to-br from-[rgba(126,215,193,0.14)] to-[var(--bg-panel)]',
        message.role === 'assistant' && 'mr-auto',
        optimisticStatus === 'streaming' &&
          'border-[rgba(126,215,193,0.45)] shadow-[0_0_0_1px_rgba(126,215,193,0.2)] motion-safe:animate-[stream-bubble-hint_2.4s_ease-in-out_infinite] motion-reduce:animate-none',
      )}
      data-status={optimisticStatus ?? undefined}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--text-sm)] text-[var(--text-muted)]">
        <span>{message.role}</span>
        {message.selectedModel ? (
          <span className="rounded-full border border-[color:var(--border)] bg-[var(--bg-muted)] px-[0.55rem] py-[0.22rem]">
            {message.selectedModel}
          </span>
        ) : null}
        <MessageMetaTime
          createdAt={message.createdAt}
          optimisticStatus={optimisticStatus}
        />
        {optimisticStatus === 'pending' ? (
          <span className="font-medium text-[var(--text-muted)]">Sending...</span>
        ) : null}
        {optimisticStatus === 'failed' ? (
          <span className="font-medium text-[var(--danger)]">Failed to send</span>
        ) : null}
        {optimisticStatus === 'streaming' ? (
          <span className="font-medium text-[var(--accent)]">Streaming</span>
        ) : null}
      </div>
      <MessageBody
        content={message.content}
        optimisticStatus={optimisticStatus}
        role={message.role}
      />
    </article>
  )
}

function LoadingTailBubble() {
  return (
    <article
      className={cn(
        bubbleShell,
        'mr-auto opacity-80',
        'border-[color:var(--border)] bg-[var(--bg-panel)]',
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--text-sm)] text-[var(--text-muted)]">
        <span>assistant</span>
      </div>
      <p className="m-0 max-w-[var(--prose-max-width)] whitespace-pre-wrap leading-[1.65]">
        Waiting for Ollama...
      </p>
    </article>
  )
}

const listShell =
  'flex min-h-0 flex-[1_1_0] flex-col gap-[0.85rem] overflow-y-auto py-1 pl-0 pr-[0.35rem]'

/**
 * Renders the chat transcript with optional optimistic status markers and
 * a loading tail bubble when `isLoading` is true and messages exist.
 */
export function MessageList({
  isLoading,
  isLoadingSession = false,
  messages,
}: MessageListProps) {
  const parentRef = useRef<HTMLElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const listedMessages = filterRenderableMessages(messages)
  const useVirtual = listedMessages.length > MESSAGE_VIRTUAL_THRESHOLD
  const count = listedMessages.length + (isLoading ? 1 : 0)

  const virtualizer = useVirtualizer({
    count,
    enabled: useVirtual,
    estimateSize: () => 96,
    getScrollElement: () => parentRef.current,
    overscan: 10,
  })

  useEffect(() => {
    if (!useVirtual) {
      endRef.current?.scrollIntoView?.({ block: 'end' })
      return
    }
    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(Math.max(0, count - 1), { align: 'end' })
    })
  }, [count, isLoading, useVirtual, virtualizer])

  if (listedMessages.length === 0) {
    if (isLoadingSession) {
      return (
        <section
          aria-busy
          aria-label="Messages"
          className="flex min-h-[200px] flex-col gap-3 px-0 py-2"
        >
          <div
            className={cn(
              'h-[3.2rem] rounded-[20px] bg-gradient-to-r from-[rgba(81,97,126,0.2)] via-[rgba(81,97,126,0.35)] to-[rgba(81,97,126,0.2)] bg-[length:200%_100%] motion-safe:animate-[message-skeleton-shine_1.1s_ease-in-out_infinite] motion-reduce:animate-none motion-reduce:bg-[rgba(81,97,126,0.22)]',
            )}
          />
          <div
            className={cn(
              'mr-auto h-[2.6rem] w-[72%] rounded-[20px] bg-gradient-to-r from-[rgba(81,97,126,0.2)] via-[rgba(81,97,126,0.35)] to-[rgba(81,97,126,0.2)] bg-[length:200%_100%] motion-safe:animate-[message-skeleton-shine_1.1s_ease-in-out_infinite] motion-reduce:animate-none motion-reduce:bg-[rgba(81,97,126,0.22)]',
            )}
          />
          <p className="mt-2 text-center text-[0.9rem] text-[var(--text-muted)]">
            Loading session...
          </p>
        </section>
      )
    }

    return (
      <section aria-label="Messages" className="grid min-h-[240px] place-items-center">
        <div className="max-w-[var(--prose-max-width)] text-center text-[var(--text-muted)]">
          <p className="mb-[0.4rem] text-[length:var(--text-xs)] uppercase tracking-[0.12em]">
            No messages yet
          </p>
          <h3 className="mb-2 text-[length:var(--text-lg)] font-semibold text-[var(--text)]">
            Start a conversation
          </h3>
          <p className="m-0 text-[length:var(--text-base)] leading-[1.55]">
            Type below and send. Your session is saved to PostgreSQL so you can return
            anytime.
          </p>
        </div>
      </section>
    )
  }

  if (!useVirtual) {
    return (
      <section aria-busy={isLoading} aria-label="Messages" className={listShell}>
        {listedMessages.map((message) => (
          <MessageArticle key={message.id} message={message} />
        ))}
        {isLoading ? <LoadingTailBubble /> : null}
        <div aria-hidden ref={endRef} />
      </section>
    )
  }

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <section
      aria-busy={isLoading}
      aria-label="Messages"
      className={cn(listShell)}
      ref={parentRef}
    >
      <div
        className="w-full"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
          width: '100%',
        }}
      >
        {virtualItems.map((vi) => {
          const isLoaderRow = vi.index >= listedMessages.length
          const message = listedMessages[vi.index]
          return (
            <div
              className="pb-[0.85rem]"
              data-index={vi.index}
              key={vi.key}
              ref={virtualizer.measureElement}
              style={{
                left: 0,
                position: 'absolute',
                top: 0,
                transform: `translateY(${vi.start}px)`,
                width: '100%',
              }}
            >
              {isLoaderRow ? (
                isLoading ? (
                  <LoadingTailBubble />
                ) : null
              ) : (
                <MessageArticle message={message} />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
