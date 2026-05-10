import type { ChatSessionSummary } from '@local/shared'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatSidebar } from './ChatSidebar'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    className,
    to,
  }: {
    children: React.ReactNode
    className?: string
    to: string
  }) => (
    <a className={className} href={to}>
      {children}
    </a>
  ),
}))

const sessions: ChatSessionSummary[] = [
  {
    id: 's1',
    title: 'My chat',
    conversationMode: 'regular',
    crewTemplateId: null,
    sceneState: {},
    createdAt: new Date('2026-05-01T10:00:00Z').toISOString(),
    updatedAt: new Date('2026-05-01T12:00:00Z').toISOString(),
  },
]

describe('ChatSidebar delete confirmation', () => {
  beforeEach(() => {
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = vi.fn(function mockShowModal(
        this: HTMLDialogElement,
      ) {
        this.setAttribute('open', '')
      })
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = vi.fn(function mockClose(
        this: HTMLDialogElement,
      ) {
        this.removeAttribute('open')
      })
    }
  })

  afterEach(() => {
    cleanup()
  })

  it('opens confirmation dialog when delete is clicked', () => {
    const onDeleteSession = vi.fn()
    render(
      <ChatSidebar
        activeSessionId="s1"
        onCreateSession={() => {}}
        onDeleteSession={onDeleteSession}
        onSelectSession={() => {}}
        sessions={sessions}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /delete my chat/i }))

    expect(screen.getByRole('heading', { name: /delete conversation/i })).toBeVisible()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('My chat')).toBeVisible()
    expect(onDeleteSession).not.toHaveBeenCalled()
  })

  it('calls onDeleteSession only after confirm', () => {
    const onDeleteSession = vi.fn()
    render(
      <ChatSidebar
        activeSessionId="s1"
        onCreateSession={() => {}}
        onDeleteSession={onDeleteSession}
        onSelectSession={() => {}}
        sessions={sessions}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /delete my chat/i }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    expect(onDeleteSession).toHaveBeenCalledWith('s1')
  })

  it('cancels without deleting', () => {
    const onDeleteSession = vi.fn()
    render(
      <ChatSidebar
        activeSessionId="s1"
        onCreateSession={() => {}}
        onDeleteSession={onDeleteSession}
        onSelectSession={() => {}}
        sessions={sessions}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /delete my chat/i }))
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(onDeleteSession).not.toHaveBeenCalled()
  })
})
