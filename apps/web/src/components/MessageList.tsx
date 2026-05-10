import type { ChatMessage } from '@local/shared'
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

type OptimisticStatus = 'pending' | 'failed'

/**
 * Extract the optimistic `clientStatus` marker written into the message
 * metadata by `sendMessageMutation.onMutate` / `onError` (P1-WEB-02).
 * Persisted server messages never carry this key.
 */
function getOptimisticStatus(message: ChatMessage): OptimisticStatus | null {
  const raw = message.metadata?.clientStatus
  if (raw === 'pending' || raw === 'failed') {
    return raw
  }
  return null
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
  if (messages.length === 0) {
    if (isLoadingSession) {
      return (
        <section
          aria-busy
          aria-label="Messages"
          className="message-list message-list--skeleton"
        >
          <div className="message-skeleton" />
          <div className="message-skeleton" />
          <p className="message-list__status">Loading session…</p>
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

  return (
    <section
      aria-busy={isLoading}
      aria-label="Messages"
      className="message-list"
    >
      {messages.map((message) => {
        const optimisticStatus = getOptimisticStatus(message)
        const extraClass = optimisticStatus
          ? ` message-bubble--${optimisticStatus}`
          : ''
        return (
          <article
            className={`message-bubble message-bubble--${message.role}${extraClass}`}
            data-status={optimisticStatus ?? undefined}
            key={message.id}
          >
            <div className="message-bubble__meta">
              <span>{message.role}</span>
              {message.selectedModel ? (
                <span className="message-model">{message.selectedModel}</span>
              ) : null}
              <time dateTime={message.createdAt}>
                {formatTime(message.createdAt)}
              </time>
              {optimisticStatus === 'pending' ? (
                <span className="message-status message-status--pending">
                  Sending...
                </span>
              ) : null}
              {optimisticStatus === 'failed' ? (
                <span className="message-status message-status--failed">
                  Failed to send
                </span>
              ) : null}
            </div>
            <p>{message.content}</p>
          </article>
        )
      })}
      {isLoading ? (
        <article className="message-bubble message-bubble--assistant loading-bubble">
          <div className="message-bubble__meta">
            <span>assistant</span>
          </div>
          <p>Waiting for Ollama...</p>
        </article>
      ) : null}
    </section>
  )
}
