import type { ChatMessage } from '@local/shared'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef } from 'react'
import { MessageMarkdown } from '~/components/MessageMarkdown'
import { formatTime } from '~/lib/format'

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

function MessageBody({
  role,
  content,
  optimisticStatus,
}: {
  role: ChatMessage['role']
  content: string
  optimisticStatus: OptimisticStatus | null
}) {
  if (role === 'assistant') {
    if (!content.trim() && optimisticStatus === 'streaming') {
      return (
        <p className="message-bubble__plain">Starting response...</p>
      )
    }
    if (!content) {
      return <p className="message-bubble__plain" />
    }
    return <MessageMarkdown content={content} />
  }

  return <p className="message-bubble__plain">{content}</p>
}

function MessageArticle({
  message,
}: {
  message: ChatMessage
}) {
  const optimisticStatus = getOptimisticStatus(message)
  const extraClass = optimisticStatus
    ? ` message-bubble--${optimisticStatus}`
    : ''

  return (
    <article
      className={`message-bubble message-bubble--${message.role}${extraClass}`}
      data-status={optimisticStatus ?? undefined}
    >
      <div className="message-bubble__meta">
        <span>{message.role}</span>
        {message.selectedModel ? (
          <span className="message-model">{message.selectedModel}</span>
        ) : null}
        <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
        {optimisticStatus === 'pending' ? (
          <span className="message-status message-status--pending">Sending...</span>
        ) : null}
        {optimisticStatus === 'failed' ? (
          <span className="message-status message-status--failed">
            Failed to send
          </span>
        ) : null}
        {optimisticStatus === 'streaming' ? (
          <span className="message-status message-status--streaming">
            Streaming
          </span>
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
    <article className="message-bubble message-bubble--assistant loading-bubble">
      <div className="message-bubble__meta">
        <span>assistant</span>
      </div>
      <p className="message-bubble__plain">Waiting for Ollama...</p>
    </article>
  )
}

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
          className="message-list message-list--skeleton"
        >
          <div className="message-skeleton" />
          <div className="message-skeleton" />
          <p className="message-list__status">Loading session...</p>
        </section>
      )
    }

    return (
      <section
        aria-label="Messages"
        className="message-list message-list--empty"
      >
        <div className="empty-state">
          <p className="empty-state__eyebrow">No messages yet</p>
          <h3 className="empty-state__title">Start a conversation</h3>
          <p className="empty-state__body">
            Type below and send. Your session is saved to PostgreSQL so you can
            return anytime.
          </p>
        </div>
      </section>
    )
  }

  if (!useVirtual) {
    return (
      <section
        aria-busy={isLoading}
        aria-label="Messages"
        className="message-list"
      >
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
      className="message-list message-list--virtual"
      ref={parentRef}
    >
      <div
        className="message-list__virtual-inner"
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
              className="message-list__virtual-row"
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
