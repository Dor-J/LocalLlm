/**
 * Barrel exports for the chat feature slice. Keeping this file tiny so the
 * route can grab everything it needs from a single import path while each
 * hook / component stays independently testable (P1-WEB-03).
 */

export { ChatHeader } from './ChatHeader'
export { ErrorBanner } from './ErrorBanner'
export { RuntimeBanner } from './RuntimeBanner'
export {
  computeChatCapabilities,
  type ChatCapabilities,
  type ChatCapabilitiesInput,
} from './capabilities'
export { loadInitialChatState, type InitialChatState } from './initial-state'
export {
  useChatActions,
  type ChatPageActions,
  type UseChatActionsArgs,
} from './use-chat-actions'
export { useChatCapabilities } from './use-chat-capabilities'
export { useChatDraft, type UseChatDraftResult } from './use-chat-draft'
export { useChatLiveAnnouncements } from './use-chat-live-announcements'
export {
  useChatSessions,
  type UseChatSessionsArgs,
  type UseChatSessionsResult,
} from './use-chat-sessions'
export {
  useOrchestrationRuns,
  type UseOrchestrationRunsArgs,
  type UseOrchestrationRunsResult,
} from './use-orchestration-runs'
export {
  useRuntimeHealth,
  type UseRuntimeHealthResult,
} from './use-runtime-health'
export {
  buildOptimisticUserMessage,
  createOptimisticId,
  getErrorMessage,
  resolveCrewTemplateId,
  resolveSessionSelectedModel,
} from './utils'
