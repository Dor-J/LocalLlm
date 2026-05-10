import type { ChatMessage } from '@local/shared'
import { useEffect, useRef, useState } from 'react'

export interface UseChatLiveAnnouncementsArgs {
  error: string | null
  isSending: boolean
  messages: ChatMessage[]
}

/**
 * Drives a polite aria-live region for errors and assistant completion (not per-token).
 */
export function useChatLiveAnnouncements({
  error,
  isSending,
  messages,
}: UseChatLiveAnnouncementsArgs) {
  const [message, setMessage] = useState('')
  const prevSendingRef = useRef(false)
  const prevErrorRef = useRef<string | null>(null)

  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      setMessage(error)
    }
    prevErrorRef.current = error
  }, [error])

  useEffect(() => {
    const wasSending = prevSendingRef.current
    prevSendingRef.current = isSending
    if (!wasSending || isSending || error) {
      return
    }
    const last = messages[messages.length - 1]
    const status = last?.metadata?.clientStatus
    if (
      last?.role === 'assistant' &&
      status !== 'streaming' &&
      status !== 'pending' &&
      status !== 'failed'
    ) {
      setMessage('Assistant finished responding.')
    }
  }, [error, isSending, messages])

  useEffect(() => {
    if (!message) {
      return
    }
    const id = window.setTimeout(() => setMessage(''), 2500)
    return () => window.clearTimeout(id)
  }, [message])

  const liveRegion = (
    <div aria-atomic className="sr-only" aria-live="polite" role="status">
      {message}
    </div>
  )

  return { liveRegion }
}
