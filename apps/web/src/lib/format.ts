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
