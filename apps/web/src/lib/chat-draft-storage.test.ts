import { afterEach, describe, expect, it } from 'vitest'
import {
  getChatDraftStorageKey,
  readChatDraft,
  writeChatDraft,
} from './chat-draft-storage'

describe('chat-draft-storage', () => {
  afterEach(() => {
    window.sessionStorage.clear()
  })

  it('stores drafts per session id', () => {
    writeChatDraft('session-1', 'first')
    writeChatDraft('session-2', 'second')

    expect(readChatDraft('session-1')).toBe('first')
    expect(readChatDraft('session-2')).toBe('second')
  })

  it('uses a stable key for a new unsaved chat', () => {
    writeChatDraft(null, 'new chat draft')

    expect(window.sessionStorage.getItem(getChatDraftStorageKey(null))).toBe(
      'new chat draft',
    )
  })

  it('removes empty drafts', () => {
    writeChatDraft('session-1', 'draft')
    writeChatDraft('session-1', '')

    expect(readChatDraft('session-1')).toBe('')
  })
})
