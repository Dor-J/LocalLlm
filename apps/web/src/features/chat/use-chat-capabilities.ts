/**
 * Thin React hook over `computeChatCapabilities` so the chat page can read
 * the derived flags without re-implementing the comparison (P1-WEB-03).
 */

import { useMemo } from 'react'
import {
  computeChatCapabilities,
  type ChatCapabilities,
  type ChatCapabilitiesInput,
} from './capabilities'

export function useChatCapabilities(
  input: ChatCapabilitiesInput,
): ChatCapabilities {
  const { health, selectedModel, draftImages } = input
  return useMemo(
    () => computeChatCapabilities({ health, selectedModel, draftImages }),
    [health, selectedModel, draftImages],
  )
}
