const CHAT_DRAFT_PREFIX = 'local-llm:chat-draft:'

export function getChatDraftStorageKey(sessionId: string | null) {
  return `${CHAT_DRAFT_PREFIX}${sessionId ?? 'new'}`
}

export function readChatDraft(sessionId: string | null): string {
  if (typeof window === 'undefined') {
    return ''
  }
  try {
    return (
      window.sessionStorage.getItem(getChatDraftStorageKey(sessionId)) ?? ''
    )
  } catch {
    return ''
  }
}

export function writeChatDraft(sessionId: string | null, value: string) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    const key = getChatDraftStorageKey(sessionId)
    if (value) {
      window.sessionStorage.setItem(key, value)
    } else {
      window.sessionStorage.removeItem(key)
    }
  } catch {
    // Draft persistence should never block composing or sending a message.
  }
}
