const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeStyle: 'short',
})

export function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value))
}

export function formatTime(value: string) {
  return timeFormatter.format(new Date(value))
}

/**
 * Formats elapsed whole seconds as `m:ss` (e.g. `0:05`, `3:02`).
 */
export function formatElapsedMinuteSeconds(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds))
  const mm = Math.floor(secs / 60)
  const ss = secs % 60
  return `${mm}:${ss.toString().padStart(2, '0')}`
}
