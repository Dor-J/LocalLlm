/**
 * Pure derivations that translate runtime health + draft state into UI affordances
 * (composer enablement, banner copy). Extracted so the chat page doesn't own
 * any of this logic directly (P1-WEB-03).
 */

import type {
  ChatModel,
  HealthResponse,
  ImageAssetSummary,
} from '@local/shared'

export interface ChatCapabilitiesInput {
  health: HealthResponse | null
  selectedModel: ChatModel
  draftImages: ImageAssetSummary[]
}

export interface ChatCapabilities {
  selectedModelAvailable: boolean
  draftImagesAllowed: boolean
  canSendMessages: boolean
  composerDisabledReason: string | null
  statusBanner: string | null
}

/**
 * Compute composer/banner state from runtime health and the current draft.
 * Kept pure so hooks can memoize it from the same inputs without re-renders.
 */
export function computeChatCapabilities({
  health,
  selectedModel,
  draftImages,
}: ChatCapabilitiesInput): ChatCapabilities {
  const selectedModelAvailable = health
    ? !health.ollama.missingAllowedModels.includes(selectedModel)
    : false
  const draftImagesAllowed = selectedModel === 'gemma4:e2b'
  const canSendMessages =
    Boolean(health?.ollama.ready) &&
    selectedModelAvailable &&
    (draftImages.length === 0 || draftImagesAllowed)

  return {
    selectedModelAvailable,
    draftImagesAllowed,
    canSendMessages,
    composerDisabledReason: getComposerDisabledReason({
      health,
      selectedModel,
      draftImages,
    }),
    statusBanner: getRuntimeBanner({ health, selectedModel, draftImages }),
  }
}

function getComposerDisabledReason({
  health,
  selectedModel,
  draftImages,
}: ChatCapabilitiesInput) {
  if (!health) {
    return 'API health is unavailable. Check whether the backend is running.'
  }
  if (!health.ollama.ready) {
    return `Ollama is not running or not reachable at ${health.ollama.baseUrl}. Start Ollama, then refresh runtime.`
  }
  if (health.ollama.missingAllowedModels.includes(selectedModel)) {
    return `The selected model ${selectedModel} is not pulled in Ollama yet. Pull it or switch to an available model, then refresh runtime.`
  }
  if (draftImages.length > 0 && selectedModel !== 'gemma4:e2b') {
    return 'Image attachments are only sent with gemma4:e2b. Switch back to gemma4:e2b or remove the attachments.'
  }
  return null
}

function getRuntimeBanner({
  health,
  selectedModel,
  draftImages,
}: ChatCapabilitiesInput) {
  if (!health) {
    return 'API health could not be loaded. Confirm the FastAPI backend is running.'
  }
  if (!health.ollama.ready) {
    return `Ollama not running. Start Ollama so the API can reach ${health.ollama.baseUrl}, then click Refresh runtime.`
  }
  if (health.ollama.missingAllowedModels.includes(selectedModel)) {
    return `Ollama is running, but ${selectedModel} is not available yet. Pulled models: ${
      health.ollama.availableModels.join(', ') || 'none'
    }.`
  }
  if (draftImages.length > 0 && selectedModel !== 'gemma4:e2b') {
    return 'Draft images are waiting in the composer, but they will only be sent with gemma4:e2b.'
  }
  return null
}
