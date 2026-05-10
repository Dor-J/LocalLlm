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
    <div
      className="rounded-[10px] border border-[rgba(255,201,107,0.28)] bg-[rgba(83,57,19,0.34)] px-4 py-[0.95rem] text-[#ffe6b3]"
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  )
}
