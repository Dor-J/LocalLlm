/**
 * Pure helpers shared between the chat page and the feature hooks (P1-WEB-03).
 * Keeping them free of React / query-client imports so they can be unit-tested
 * in isolation and reused from any component.
 */

import type {
  ChatMessage,
  ChatModel,
  ConversationMode,
  CrewTemplateId,
} from '@local/shared'
import { DEFAULT_CHAT_MODEL } from '@local/shared'
import { ApiError } from '~/lib/api'

/**
 * Extract a human-readable error message from an unknown throwable.
 * Falls back to 'Unknown error' when the cause has no `.message`.
 */
export function getErrorMessage(cause: unknown): string {
  if (cause instanceof ApiError) {
    return cause.message
  }
  if (cause instanceof Error) {
    return cause.message
  }
  return 'Unknown error'
}

/**
 * Walk the message history from newest to oldest and surface the most recent
 * `selectedModel` so reopening a session continues with the same model.
 */
export function resolveSessionSelectedModel(
  messages: ChatMessage[],
): ChatModel {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.selectedModel) {
      return message.selectedModel
    }
  }
  return DEFAULT_CHAT_MODEL
}

/**
 * Coerce the crew-template id into a value consistent with the session's
 * conversation mode (regular => null, task => research-assistant, roleplay
 * => one of the roleplay templates).
 */
export function resolveCrewTemplateId(
  mode: ConversationMode,
  crewTemplateId: CrewTemplateId | null,
): CrewTemplateId | null {
  if (mode === 'regular') {
    return null
  }

  if (mode === 'task') {
    return crewTemplateId === 'research-assistant'
      ? crewTemplateId
      : 'research-assistant'
  }

  if (
    crewTemplateId === 'roleplay-fantasy' ||
    crewTemplateId === 'roleplay-debate'
  ) {
    return crewTemplateId
  }

  return 'roleplay-fantasy'
}

/**
 * Generate a locally-unique id for optimistic user messages (P1-WEB-02).
 * Namespacing under `optimistic-` keeps it distinct from server UUIDs.
 */
export function createOptimisticId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `optimistic-${crypto.randomUUID()}`
  }
  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Build an in-flight user message used while `sendMessage` is pending.
 * `metadata.clientStatus` is the render-time hint consumed by MessageList.
 */
export function buildOptimisticUserMessage(args: {
  sessionId: string
  tempId: string
  content: string
  selectedModel: ChatModel
}): ChatMessage {
  return {
    id: args.tempId,
    sessionId: args.sessionId,
    role: 'user',
    content: args.content,
    selectedModel: args.selectedModel,
    metadata: { clientStatus: 'pending' },
    createdAt: new Date().toISOString(),
  }
}
