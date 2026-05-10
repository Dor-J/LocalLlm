/**
 * Runtime-health query with background polling, exponential retry, and a
 * debounced manual refresh (P1-WEB-04).
 *
 * - Polls every `HEALTH_REFETCH_INTERVAL_MS` while the tab is visible and
 *   pauses when the document is hidden, to avoid background traffic when
 *   the operator is on another tab.
 * - Retries up to three times for 5xx responses with exponential backoff;
 *   4xx errors (and ApiErrors with status < 500) stop immediately so we
 *   don't hammer the API on a client-side mistake.
 * - `refresh()` is leading-edge debounced so double-clicking the
 *   "Refresh runtime" button won't spawn concurrent requests.
 */

import type { HealthResponse } from '@local/shared'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { ApiError, api } from '~/lib/api'
import { chatKeys } from '~/lib/query-client'

export const HEALTH_REFETCH_INTERVAL_MS = 15_000
export const HEALTH_MANUAL_REFRESH_DEBOUNCE_MS = 500
export const HEALTH_MAX_RETRIES = 3

export interface UseRuntimeHealthResult {
  health: HealthResponse | null
  isRefreshing: boolean
  refresh: () => Promise<void>
  query: UseQueryResult<HealthResponse>
}

export function useRuntimeHealth(
  initialHealth: HealthResponse | null,
): UseRuntimeHealthResult {
  const query = useQuery<HealthResponse>({
    queryKey: chatKeys.health,
    queryFn: api.health,
    initialData: initialHealth ?? undefined,
    refetchInterval: HEALTH_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    retry: shouldRetryHealth,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 30_000),
  })

  const lastManualRefreshAt = useRef(0)

  const refresh = useCallback(async () => {
    const now = Date.now()
    if (now - lastManualRefreshAt.current < HEALTH_MANUAL_REFRESH_DEBOUNCE_MS) {
      return
    }
    lastManualRefreshAt.current = now
    await query.refetch()
  }, [query])

  return {
    health: query.data ?? null,
    isRefreshing: query.isFetching,
    refresh,
    query,
  }
}

/**
 * Retry predicate exported for unit testing. Retries only on 5xx responses
 * (or unknown/transport errors), up to HEALTH_MAX_RETRIES attempts.
 */
export function shouldRetryHealth(
  failureCount: number,
  error: unknown,
): boolean {
  if (failureCount >= HEALTH_MAX_RETRIES) {
    return false
  }
  if (error instanceof ApiError) {
    return error.status >= 500
  }
  return true
}
