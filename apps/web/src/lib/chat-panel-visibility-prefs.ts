/**
 * Persists chat footer panel visibility and whether the orchestration trace row
 * is expanded in localStorage so choices survive reloads.
 */

export const CHAT_PANEL_VISIBILITY_STORAGE_KEY =
  'local-llm:chat-panel-visibility'

export interface ChatPanelVisibilityPrefs {
  showCrewTemplatePanel: boolean
  /** When false, only a one-line trace summary is shown (default). */
  tracePanelExpanded: boolean
}

/** SSR-safe initial panel prefs (matches server when storage is unavailable). */
export const DEFAULT_CHAT_PANEL_VISIBILITY_PREFS: ChatPanelVisibilityPrefs = {
  showCrewTemplatePanel: false,
  tracePanelExpanded: false,
}

const DEFAULT_PREFS = DEFAULT_CHAT_PANEL_VISIBILITY_PREFS

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parsePrefs(raw: string | null): ChatPanelVisibilityPrefs {
  if (raw == null || raw === '') {
    return { ...DEFAULT_PREFS }
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) {
      return { ...DEFAULT_PREFS }
    }
    const withTrace: Record<string, unknown> = { ...parsed }
    if (typeof withTrace.tracePanelExpanded !== 'boolean') {
      withTrace.tracePanelExpanded = false
    }
    if (
      typeof withTrace.showCrewTemplatePanel !== 'boolean'
    ) {
      return { ...DEFAULT_PREFS }
    }
    return {
      showCrewTemplatePanel: withTrace.showCrewTemplatePanel as boolean,
      tracePanelExpanded: withTrace.tracePanelExpanded as boolean,
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

/**
 * Reads panel visibility from localStorage. Returns defaults when storage is
 * unavailable, missing, or invalid.
 */
export function readChatPanelVisibilityPrefs(): ChatPanelVisibilityPrefs {
  if (typeof localStorage === 'undefined') {
    return { ...DEFAULT_PREFS }
  }
  try {
    return parsePrefs(localStorage.getItem(CHAT_PANEL_VISIBILITY_STORAGE_KEY))
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

/**
 * Writes panel visibility to localStorage. Swallows quota and security errors.
 */
export function writeChatPanelVisibilityPrefs(
  prefs: ChatPanelVisibilityPrefs,
): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(
      CHAT_PANEL_VISIBILITY_STORAGE_KEY,
      JSON.stringify(prefs),
    )
  } catch {
    // QuotaExceededError, SecurityError in private mode, etc.
  }
}
