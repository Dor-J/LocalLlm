/**
 * Fake-timer coverage for the runtime-health polling interval and the
 * backoff retry predicate (P1-WEB-04).
 */

import type { HealthResponse } from '@local/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/lib/api', async () => {
  const actual = await vi.importActual<typeof import('~/lib/api')>('~/lib/api')
  return {
    ...actual,
    api: {
      ...actual.api,
      health: vi.fn(),
    },
  }
})

import { api, ApiError } from '~/lib/api'
import {
  HEALTH_REFETCH_INTERVAL_MS,
  shouldRetryHealth,
  useRuntimeHealth,
} from './use-runtime-health'

function makeHealth(status: 'ok' | 'degraded' = 'ok'): HealthResponse {
  return {
    status,
    appName: 'local-llm',
    allowedModels: [],
    agentOrchestrationEnabled: false,
    ollama: {
      ready: true,
      baseUrl: 'http://localhost:11434',
      availableModels: [],
      missingAllowedModels: [],
      error: null,
    },
    timestamp: new Date('2026-04-21T12:00:00Z').toISOString(),
  }
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('shouldRetryHealth', () => {
  it('stops after HEALTH_MAX_RETRIES attempts', () => {
    expect(shouldRetryHealth(3, new ApiError('x', 503))).toBe(false)
  })

  it('retries on 5xx ApiError within the limit', () => {
    expect(shouldRetryHealth(0, new ApiError('down', 503))).toBe(true)
    expect(shouldRetryHealth(1, new ApiError('bad gw', 502))).toBe(true)
  })

  it('does not retry on 4xx ApiError', () => {
    expect(shouldRetryHealth(0, new ApiError('nope', 404))).toBe(false)
    expect(shouldRetryHealth(0, new ApiError('bad', 400))).toBe(false)
  })

  it('retries on non-ApiError transport failures', () => {
    expect(shouldRetryHealth(0, new Error('network boom'))).toBe(true)
  })
})

describe('useRuntimeHealth polling interval', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(api.health).mockReset()
    vi.mocked(api.health).mockResolvedValue(makeHealth())
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('refetches every HEALTH_REFETCH_INTERVAL_MS while the tab is visible', async () => {
    const { result } = renderHook(() => useRuntimeHealth(null), {
      wrapper: Wrapper,
    })

    await waitFor(() => {
      expect(result.current.health).not.toBeNull()
    })
    const initialCalls = vi.mocked(api.health).mock.calls.length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HEALTH_REFETCH_INTERVAL_MS + 50)
    })
    await waitFor(() => {
      expect(vi.mocked(api.health).mock.calls.length).toBeGreaterThan(
        initialCalls,
      )
    })

    const afterFirst = vi.mocked(api.health).mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HEALTH_REFETCH_INTERVAL_MS + 50)
    })
    await waitFor(() => {
      expect(vi.mocked(api.health).mock.calls.length).toBeGreaterThan(
        afterFirst,
      )
    })
  })
})
