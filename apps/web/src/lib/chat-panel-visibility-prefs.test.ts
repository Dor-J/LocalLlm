import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHAT_PANEL_VISIBILITY_STORAGE_KEY,
  readChatPanelVisibilityPrefs,
  writeChatPanelVisibilityPrefs,
} from './chat-panel-visibility-prefs'

function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key: string) {
      return map.get(key) ?? null
    },
    key(index: number) {
      return [...map.keys()][index] ?? null
    },
    removeItem(key: string) {
      map.delete(key)
    },
    setItem(key: string, value: string) {
      map.set(key, value)
    },
  }
}

describe('chat-panel-visibility-prefs', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns defaults when storage is missing', () => {
    const store = createMemoryStorage()
    vi.stubGlobal('localStorage', store)
    expect(readChatPanelVisibilityPrefs()).toEqual({
      showCrewTemplatePanel: false,
      tracePanelExpanded: false,
    })
  })

  it('round-trips prefs through write and read', () => {
    const store = createMemoryStorage()
    vi.stubGlobal('localStorage', store)
    writeChatPanelVisibilityPrefs({
      showCrewTemplatePanel: false,
      tracePanelExpanded: true,
    })
    expect(store.getItem(CHAT_PANEL_VISIBILITY_STORAGE_KEY)).toBe(
      JSON.stringify({
        showCrewTemplatePanel: false,
        tracePanelExpanded: true,
      }),
    )
    expect(readChatPanelVisibilityPrefs()).toEqual({
      showCrewTemplatePanel: false,
      tracePanelExpanded: true,
    })
  })

  it('falls back to defaults on invalid JSON', () => {
    const store = createMemoryStorage()
    store.setItem(CHAT_PANEL_VISIBILITY_STORAGE_KEY, 'not-json{')
    vi.stubGlobal('localStorage', store)
    expect(readChatPanelVisibilityPrefs()).toEqual({
      showCrewTemplatePanel: false,
      tracePanelExpanded: false,
    })
  })

  it('falls back to defaults when booleans are wrong type', () => {
    const store = createMemoryStorage()
    store.setItem(
      CHAT_PANEL_VISIBILITY_STORAGE_KEY,
      JSON.stringify({
        showCrewTemplatePanel: 'yes',
        tracePanelExpanded: false,
      }),
    )
    vi.stubGlobal('localStorage', store)
    expect(readChatPanelVisibilityPrefs()).toEqual({
      showCrewTemplatePanel: false,
      tracePanelExpanded: false,
    })
  })

  it('ignores removed device-panel storage and adds tracePanelExpanded false', () => {
    const store = createMemoryStorage()
    store.setItem(
      CHAT_PANEL_VISIBILITY_STORAGE_KEY,
      JSON.stringify({
        ['show' + 'DevicePanel']: true,
        showCrewTemplatePanel: true,
      }),
    )
    vi.stubGlobal('localStorage', store)
    expect(readChatPanelVisibilityPrefs()).toEqual({
      showCrewTemplatePanel: true,
      tracePanelExpanded: false,
    })
  })

  it('read returns defaults when localStorage is undefined', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(readChatPanelVisibilityPrefs()).toEqual({
      showCrewTemplatePanel: false,
      tracePanelExpanded: false,
    })
  })

  it('write no-ops when localStorage is undefined', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(() =>
      writeChatPanelVisibilityPrefs({
        showCrewTemplatePanel: false,
        tracePanelExpanded: false,
      }),
    ).not.toThrow()
  })
})
