import { QueryClient } from '@tanstack/react-query'

/**
 * Singleton {@link QueryClient} used by the web app.
 *
 * The 15s `staleTime` matches the desired runtime-health refetch cadence
 * (see P1-WEB-04) so manual refreshes and navigation stay responsive without
 * hammering the API.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * Typed query-key factory for chat-related data.
 *
 * Keep call sites using the helpers below so renames stay safe and cache
 * invalidation targets stay consistent.
 */
export const chatKeys = {
  health: ['health'] as const,
  sessions: ['sessions'] as const,
  session: (id: string) => ['session', id] as const,
  runs: (id: string) => ['runs', id] as const,
  run: (id: string) => ['run', id] as const,
}
