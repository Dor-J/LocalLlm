/**
 * Smoke-test that `QueryClientProvider` is wired correctly and `chatKeys`
 * query-keyed hooks resolve against it (P1-WEB-01).
 */

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { chatKeys } from './query-client'

function HealthProbe() {
  const query = useQuery({
    queryKey: chatKeys.health,
    queryFn: async () => ({ status: 'ok' as const }),
  })
  if (query.isLoading) {
    return <span>loading</span>
  }
  return <span data-testid="status">{query.data?.status ?? 'empty'}</span>
}

describe('chatKeys + QueryClientProvider', () => {
  it('resolves useQuery against a wrapped provider', async () => {
    const localClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={localClient}>
        <HealthProbe />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('ok')
    })
  })
})
