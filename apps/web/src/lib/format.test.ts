import { describe, expect, it } from 'vitest'
import { formatElapsedMinuteSeconds } from './format'

describe('formatElapsedMinuteSeconds', () => {
  it('formats seconds under one minute', () => {
    expect(formatElapsedMinuteSeconds(0)).toBe('0:00')
    expect(formatElapsedMinuteSeconds(5)).toBe('0:05')
    expect(formatElapsedMinuteSeconds(59)).toBe('0:59')
  })

  it('formats minutes and clamps negatives', () => {
    expect(formatElapsedMinuteSeconds(60)).toBe('1:00')
    expect(formatElapsedMinuteSeconds(125)).toBe('2:05')
    expect(formatElapsedMinuteSeconds(-10)).toBe('0:00')
  })

  it('floors fractional seconds', () => {
    expect(formatElapsedMinuteSeconds(3.9)).toBe('0:03')
  })
})
