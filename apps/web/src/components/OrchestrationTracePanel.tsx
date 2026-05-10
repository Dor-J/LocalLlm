import type {
  OrchestrationRunDetail,
  OrchestrationRunRead,
} from '@local/shared'
import { formatDateTime } from '~/lib/format'
import { cn } from '~/lib/cn'
import {
  btnSecondary,
  eyebrow as eyebrowClass,
  statusPillBase,
  statusPillOk,
} from '~/styles/ui'

export interface OrchestrationTracePanelProps {
  error: string | null
  isLoadingRuns: boolean
  isLoadingRun: boolean
  runs: OrchestrationRunRead[]
  selectedRun: OrchestrationRunDetail | null
  selectedRunId: string | null
  isExpanded: boolean
  onToggleExpanded: () => void
  onRefresh: () => void
  onSelectRun: (runId: string) => void
}

/**
 * Collapsible orchestration trace: default is a one-line summary; expanded
 * shows run list and step detail (max height set in CSS).
 */
export function OrchestrationTracePanel({
  error,
  isLoadingRuns,
  isLoadingRun,
  runs,
  selectedRun,
  selectedRunId,
  isExpanded,
  onToggleExpanded,
  onRefresh,
  onSelectRun,
}: OrchestrationTracePanelProps) {
  const latest = runs[0]
  const summaryParts: string[] = []
  if (latest) {
    summaryParts.push(`${latest.status} · ${latest.stepCount} steps`)
  }

  return (
    <section
      aria-label="Orchestration trace"
      className={cn(
        'flex min-h-0 flex-[0_1_auto] flex-col gap-[0.9rem] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[var(--bg-panel)] p-[0.85rem]',
        isExpanded
          ? 'max-h-[min(40vh,28rem)]'
          : 'max-h-none flex-none px-[0.8rem] py-[0.65rem]',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <button
          aria-expanded={isExpanded}
          className="flex min-w-0 flex-[1_1_0] cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-transparent py-[0.2rem] pl-0 pr-1 text-left text-inherit hover:bg-[rgba(81,97,126,0.1)]"
          onClick={onToggleExpanded}
          type="button"
        >
          <span className="flex min-w-0 flex-col items-start gap-[0.15rem]">
            <span className={cn(eyebrowClass, 'mb-0')}>Orchestration trace</span>
            <span className="break-words text-[0.92rem] leading-[1.3] text-[var(--text)]">
              {runs.length === 0
                ? 'No runs yet'
                : `${runs.length} run${runs.length === 1 ? '' : 's'}${
                    summaryParts.length ? ` · ${summaryParts[0]}` : ''
                  }`}
            </span>
          </span>
          <span aria-hidden className="shrink-0 text-[0.8rem] text-[var(--text-muted)]">
            {isExpanded ? '▾' : '▸'}
          </span>
        </button>
        {isExpanded ? (
          <button
            className={cn(btnSecondary, 'shrink-0')}
            disabled={isLoadingRuns || isLoadingRun}
            onClick={onRefresh}
            type="button"
          >
            {isLoadingRuns || isLoadingRun ? 'Refreshing...' : 'Refresh trace'}
          </button>
        ) : null}
      </div>

      {isExpanded ? (
        <>
          {error ? (
            <div className="rounded-[18px] border border-[rgba(255,139,139,0.3)] bg-[rgba(89,21,26,0.3)] px-[0.9rem] py-[0.8rem] text-[0.86rem] leading-[1.5] text-[#ffd4d4]">
              {error}
            </div>
          ) : null}

          {runs.length === 0 ? (
            <p className="m-0 text-[0.86rem] leading-[1.5] text-[var(--text-muted)]">
              No orchestration runs have been recorded for this session yet.
            </p>
          ) : (
            <div className="grid min-h-0 flex-[1_1_0] grid-cols-1 gap-[0.9rem] overflow-auto">
              <div className="flex min-w-0 flex-col gap-3">
                {runs.map((run) => {
                  const active = run.id === selectedRunId
                  return (
                    <button
                      className={cn(
                        'flex flex-col gap-1 rounded-[10px] border border-[color:var(--border)] bg-[var(--bg-muted)] px-[0.9rem] py-[0.85rem] text-left text-[var(--text)]',
                        active &&
                          'border-[rgba(126,215,193,0.38)] bg-gradient-to-br from-[rgba(126,215,193,0.12)] to-[rgba(23,31,46,0.95)]',
                      )}
                      key={run.id}
                      onClick={() => onSelectRun(run.id)}
                      type="button"
                    >
                      <span className="font-semibold">
                        {run.conversationMode} / {run.crewTemplateId ?? 'default'}
                      </span>
                      <span className="text-[0.86rem] leading-[1.5] text-[var(--text-muted)]">
                        {run.status} · {run.stepCount} steps ·{' '}
                        {formatDateTime(run.createdAt)}
                      </span>
                      {run.prompt ? (
                        <span className="text-[0.86rem] leading-[1.5] text-[var(--text-muted)]">
                          {run.prompt}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                {selectedRun ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className={cn(statusPillBase, statusPillOk)}>
                        {selectedRun.status}
                      </span>
                      <span className={statusPillBase}>{selectedRun.backend}</span>
                      <span className={statusPillBase}>
                        {selectedRun.stepCount} steps
                      </span>
                    </div>
                    <p className="text-[0.86rem] leading-[1.5] text-[var(--text)]">
                      {selectedRun.prompt}
                    </p>
                    <div className="flex flex-col gap-3">
                      {selectedRun.steps.length === 0 ? (
                        <p className="m-0 px-0 py-[0.15rem] text-[0.86rem] leading-[1.5] text-[var(--text-muted)]">
                          No persisted step rows are available for this run.
                        </p>
                      ) : (
                        selectedRun.steps.map((step) => (
                          <article
                            className="flex flex-col gap-[0.45rem] rounded-[10px] border border-[color:var(--border)] bg-[var(--bg-muted)] px-[0.9rem] py-[0.85rem]"
                            key={step.id}
                          >
                            <div className="flex items-center justify-between gap-3 text-[0.9rem] font-semibold text-[var(--text)]">
                              <span>
                                {step.stepIndex + 1}. {step.role}
                              </span>
                              <span>{step.status}</span>
                            </div>
                            {step.inputText ? (
                              <p className="text-[0.86rem] leading-[1.5] text-[var(--text-muted)]">
                                {step.inputText}
                              </p>
                            ) : null}
                            {step.outputText ? (
                              <p className="text-[0.86rem] leading-[1.5] text-[var(--text)]">
                                {step.outputText}
                              </p>
                            ) : null}
                          </article>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <p className="m-0 text-[0.86rem] leading-[1.5] text-[var(--text-muted)]">
                    Select a run to inspect its execution steps.
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}
