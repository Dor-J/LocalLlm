import { describe, expect, it, vi } from 'vitest'
import { drainSseBuffer, parseServerSentEventBlock } from './api'

describe('chat stream parser', () => {
  it('parses a single data block', () => {
    const event = parseServerSentEventBlock(
      'data: {"type":"token","content":"hello"}',
    )

    expect(event).toEqual({ type: 'token', content: 'hello' })
  })

  it('drains multiple stream events and keeps incomplete data buffered', () => {
    const onToken = vi.fn()
    const remaining = drainSseBuffer(
      [
        'data: {"type":"token","content":"hel"}',
        '',
        'data: {"type":"token","content":"lo"}',
        '',
        'data: {"type":"token","content":"pending"}',
      ].join('\n'),
      { onToken },
    )

    expect(onToken).toHaveBeenCalledTimes(2)
    expect(onToken).toHaveBeenNthCalledWith(1, {
      type: 'token',
      content: 'hel',
    })
    expect(onToken).toHaveBeenNthCalledWith(2, {
      type: 'token',
      content: 'lo',
    })
    expect(remaining).toContain('pending')
  })

  it('dispatches error events when flushed', () => {
    const onError = vi.fn()

    const remaining = drainSseBuffer(
      'data: {"type":"error","code":"bad","detail":"Nope"}',
      { onError },
      true,
    )

    expect(remaining).toBe('')
    expect(onError).toHaveBeenCalledWith({
      type: 'error',
      code: 'bad',
      detail: 'Nope',
    })
  })

  it('throws on malformed JSON', () => {
    expect(() => parseServerSentEventBlock('data: {nope')).toThrow()
  })
})
