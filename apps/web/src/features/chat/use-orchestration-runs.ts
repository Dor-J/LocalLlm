/**
 * Hook for orchestration-trace panel data. Bundles the list + detail queries
 * (which share enablement on `activeSessionId`/`selectedRunId`) so the chat
 * page can treat the trace panel as a single concern (P1-WEB-03).
 */

import type {
  OrchestrationRunDetail,
  OrchestrationRunRead,
} from '@local/shared'
import { useQuery } from '@tanstack/react-query'
import { api } from '~/lib/api'
import { chatKeys } from '~/lib/query-client'
import type { InitialChatState } from './initial-state'

export interface UseOrchestrationRunsArgs {
  initial: InitialChatState
  activeSessionId: string | null
  selectedRunId: string | null
}

export interface UseOrchestrationRunsResult {
  runs: OrchestrationRunRead[]
  selectedRun: OrchestrationRunDetail | null
  isLoadingRuns: boolean
  isLoadingRun: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useOrchestrationRuns({
  initial,
  activeSessionId,
  selectedRunId,
}: UseOrchestrationRunsArgs): UseOrchestrationRunsResult {
  const runsQuery = useQuery<OrchestrationRunRead[]>({
    queryKey: activeSessionId
      ? chatKeys.runs(activeSessionId)
      : (['runs', 'none'] as const),
    queryFn: () => api.listOrchestrationRuns(activeSessionId as string),
    enabled: Boolean(activeSessionId),
    initialData:
      activeSessionId && activeSessionId === initial.activeSessionId
        ? initial.orchestrationRuns
        : undefined,
  })

  const runQuery = useQuery<OrchestrationRunDetail>({
    queryKey: selectedRunId
      ? chatKeys.run(selectedRunId)
      : (['run', 'none'] as const),
    queryFn: () => api.getOrchestrationRun(selectedRunId as string),
    enabled: Boolean(selectedRunId),
    initialData:
      selectedRunId && selectedRunId === initial.selectedRunId
        ? (initial.selectedRun as OrchestrationRunDetail | undefined)
        : undefined,
  })

  const error =
    runsQuery.error instanceof Error
      ? runsQuery.error.message
      : runQuery.error instanceof Error
        ? runQuery.error.message
        : null

  async function refresh() {
    if (!activeSessionId) {
      return
    }
    await runsQuery.refetch()
    if (selectedRunId) {
      await runQuery.refetch()
    }
  }

  return {
    runs: runsQuery.data ?? [],
    selectedRun: runQuery.data ?? null,
    isLoadingRuns: runsQuery.isFetching,
    isLoadingRun: runQuery.isFetching,
    error,
    refresh,
  }
}
