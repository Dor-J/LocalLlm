/**
 * Non-error advisory banner (e.g. Ollama offline, model missing) derived from
 * runtime health. Renders nothing when the message is falsy (P1-WEB-03).
 */

export interface RuntimeBannerProps {
  message: string | null
}

export function RuntimeBanner({ message }: RuntimeBannerProps) {
  if (!message) {
    return null
  }
  return (
    <div className="runtime-banner" role="status" aria-live="polite">
      {message}
    </div>
  )
}
