/**
 * Inline error banner shown above the message list whenever the chat page
 * captures an unhandled error (P1-WEB-03). Renders nothing when `message`
 * is falsy so consumers don't need to wrap it in a conditional.
 */

export interface ErrorBannerProps {
  message: string | null
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) {
    return null
  }
  return (
    <div
      className="rounded-[10px] border border-[rgba(255,139,139,0.3)] bg-[rgba(89,21,26,0.4)] px-4 py-[0.95rem] text-[#ffd4d4]"
      role="alert"
      aria-live="polite"
    >
      {message}
    </div>
  )
}
