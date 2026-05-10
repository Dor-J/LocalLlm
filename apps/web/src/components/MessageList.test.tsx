/**
 * Optimistic-render tests for MessageList (P1-WEB-02).
 * Validates that `metadata.clientStatus` drives the pending/failed indicators
 * and that dropping the temp message rolls back the UI.
 */

import type { ChatMessage } from '@local/shared'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MessageList } from './MessageList'

function makeUserMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    sessionId: 'session-1',
    role: 'user',
    content: 'Hello there',
    selectedModel: 'gemma4:e2b',
    metadata: {},
    createdAt: new Date('2026-04-21T12:00:00Z').toISOString(),
    ...overrides,
  }
}

describe('MessageList optimistic status', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders a pending badge when clientStatus is "pending"', () => {
    const pending = makeUserMessage({
      id: 'optimistic-1',
      metadata: { clientStatus: 'pending' },
    })

    render(<MessageList isLoading={false} messages={[pending]} />)

    expect(screen.getByText('Sending...')).toBeTruthy()
    expect(screen.queryByText('Failed to send')).toBeNull()
  })

  it('renders a failed badge after onError marks the temp message "failed"', () => {
    const failed = makeUserMessage({
      id: 'optimistic-1',
      metadata: { clientStatus: 'failed' },
    })

    render(<MessageList isLoading={false} messages={[failed]} />)

    expect(screen.getByText('Failed to send')).toBeTruthy()
    expect(screen.queryByText('Sending...')).toBeNull()
  })

  it('rolls back the optimistic message when it is removed from the list', () => {
    const { rerender } = render(
      <MessageList
        isLoading={false}
        messages={[
          makeUserMessage({
            id: 'optimistic-1',
            content: 'Temp content',
            metadata: { clientStatus: 'pending' },
          }),
        ]}
      />,
    )

    expect(screen.getByText('Temp content')).toBeTruthy()

    rerender(<MessageList isLoading={false} messages={[]} />)

    expect(screen.queryByText('Temp content')).toBeNull()
    expect(screen.queryByText('Sending...')).toBeNull()
  })

  it('shows no status badge for server-persisted messages', () => {
    const serverMessage = makeUserMessage({
      id: 'server-uuid',
      metadata: { tokensIn: 10, tokensOut: 5 },
    })

    render(<MessageList isLoading={false} messages={[serverMessage]} />)

    expect(screen.queryByText('Sending...')).toBeNull()
    expect(screen.queryByText('Failed to send')).toBeNull()
  })

  it('renders a streaming assistant bubble while tokens arrive', () => {
    const streaming: ChatMessage = {
      id: 'assistant-streaming',
      sessionId: 'session-1',
      role: 'assistant',
      content: 'Partial answer',
      selectedModel: 'qwen3.5:2b',
      metadata: { clientStatus: 'streaming' },
      createdAt: new Date('2026-04-21T12:00:01Z').toISOString(),
    }

    render(<MessageList isLoading messages={[streaming]} />)

    expect(screen.getByText('Streaming')).toBeVisible()
    expect(screen.getByText('Partial answer')).toBeVisible()
  })

  it('shows live elapsed m:ss for streaming messages', async () => {
    vi.useFakeTimers({ now: new Date('2026-04-21T12:00:10Z') })
    try {
      const streaming: ChatMessage = {
        id: 'assistant-streaming',
        sessionId: 'session-1',
        role: 'assistant',
        content: 'Hi',
        selectedModel: 'qwen3.5:2b',
        metadata: { clientStatus: 'streaming' },
        createdAt: new Date('2026-04-21T12:00:00Z').toISOString(),
      }

      render(<MessageList isLoading={false} messages={[streaming]} />)

      const clock = screen.getByTitle(/Started/)
      expect(clock.tagName).toBe('TIME')
      expect(clock).toHaveTextContent('0:10')

      await vi.advanceTimersByTimeAsync(3000)
      expect(clock).toHaveTextContent('0:13')
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders loading skeleton when session is loading and there are no messages', () => {
    render(<MessageList isLoading isLoadingSession messages={[]} />)

    expect(screen.getByText('Loading session...')).toBeVisible()
    expect(document.querySelector('.message-list--skeleton')).toBeTruthy()
  })

  it('renders empty state copy when not loading and there are no messages', () => {
    render(
      <MessageList isLoading={false} isLoadingSession={false} messages={[]} />,
    )

    expect(screen.getByText('No messages yet')).toBeVisible()
    expect(screen.getByText('Start a conversation')).toBeVisible()
  })

  it('renders assistant markdown as structured headings', () => {
    const assistant: ChatMessage = {
      id: 'a1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '## Section title\n\nSome **bold** text.',
      selectedModel: 'qwen3.5:2b',
      metadata: {},
      createdAt: new Date('2026-04-21T12:00:02Z').toISOString(),
    }

    render(<MessageList isLoading={false} messages={[assistant]} />)

    expect(
      screen.getByRole('heading', { level: 2, name: 'Section title' }),
    ).toBeVisible()
    expect(screen.getByText('bold')).toBeVisible()
  })

  it('renders user messages as plain text without markdown headings', () => {
    const userMsg = makeUserMessage({
      content: '## not a heading',
    })

    render(<MessageList isLoading={false} messages={[userMsg]} />)

    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByText('## not a heading')).toBeVisible()
  })

  it('skips undefined or invalid rows without crashing', () => {
    const valid = makeUserMessage({ id: 'real', content: 'Still here' })
    render(
      <MessageList
        isLoading={false}
        messages={[valid, undefined as unknown as ChatMessage]}
      />,
    )

    expect(screen.getByText('Still here')).toBeVisible()
    expect(screen.getAllByRole('article')).toHaveLength(1)
  })
})
