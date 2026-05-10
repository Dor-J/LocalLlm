/**
 * Inline error banner shown above the message list whenever the chat page
 * captures an unhandled error (P1-WEB-03). Renders nothing when `message`
 * is falsy so consumers don't need to wrap it in a conditional.
 */

import { bannerError } from '~/styles/ui'

export interface ErrorBannerProps {
  message: string | null
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) {
    return null
  }
  return (
    <div
      className={bannerError}
      role="alert"
      aria-live="polite"
    >
      {message}
    </div>
  )
}
