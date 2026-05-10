import type {
  OrchestrationRunDetail,
  OrchestrationRunRead,
} from '@local/shared'
import { formatDateTime } from '~/lib/format'

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
      className={`trace-panel ${isExpanded ? 'trace-panel--expanded' : 'trace-panel--collapsed'}`}
    >
      <div className="trace-panel__header">
        <button
          aria-expanded={isExpanded}
          className="trace-panel__toggle"
          onClick={onToggleExpanded}
          type="button"
        >
          <span className="trace-panel__toggle-label">
            <span className="eyebrow">Orchestration trace</span>
            <span className="trace-panel__toggle-title">
              {runs.length === 0
                ? 'No runs yet'
                : `${runs.length} run${runs.length === 1 ? '' : 's'}${
                    summaryParts.length ? ` · ${summaryParts[0]}` : ''
                  }`}
            </span>
          </span>
          <span aria-hidden className="trace-panel__chevron">
            {isExpanded ? '▾' : '▸'}
          </span>
        </button>
        {isExpanded ? (
          <button
            className="secondary-button trace-panel__refresh"
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
          {error ? <div className="trace-panel__error">{error}</div> : null}

          {runs.length === 0 ? (
            <p className="trace-panel__empty">
              No orchestration runs have been recorded for this session yet.
            </p>
          ) : (
            <div className="trace-panel__layout">
              <div className="trace-panel__runs">
                {runs.map((run) => {
                  const active = run.id === selectedRunId
                  return (
                    <button
                      className={`trace-run ${active ? 'trace-run--active' : ''}`}
                      key={run.id}
                      onClick={() => onSelectRun(run.id)}
                      type="button"
                    >
                      <span className="trace-run__title">
                        {run.conversationMode} /{' '}
                        {run.crewTemplateId ?? 'default'}
                      </span>
                      <span className="trace-run__meta">
                        {run.status} · {run.stepCount} steps ·{' '}
                        {formatDateTime(run.createdAt)}
                      </span>
                      {run.prompt ? (
                        <span className="trace-run__prompt">{run.prompt}</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>

              <div className="trace-panel__detail">
                {selectedRun ? (
                  <>
                    <div className="trace-panel__summary">
                      <span className="status-pill status-pill--ok">
                        {selectedRun.status}
                      </span>
                      <span className="status-pill">{selectedRun.backend}</span>
                      <span className="status-pill">
                        {selectedRun.stepCount} steps
                      </span>
                    </div>
                    <p className="trace-panel__prompt">{selectedRun.prompt}</p>
                    <div className="trace-steps">
                      {selectedRun.steps.length === 0 ? (
                        <p className="trace-panel__empty trace-panel__empty--compact">
                          No persisted step rows are available for this run.
                        </p>
                      ) : (
                        selectedRun.steps.map((step) => (
                          <article className="trace-step" key={step.id}>
                            <div className="trace-step__meta">
                              <span>
                                {step.stepIndex + 1}. {step.role}
                              </span>
                              <span>{step.status}</span>
                            </div>
                            {step.inputText ? (
                              <p className="trace-step__input">
                                {step.inputText}
                              </p>
                            ) : null}
                            {step.outputText ? (
                              <p className="trace-step__output">
                                {step.outputText}
                              </p>
                            ) : null}
                          </article>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <p className="trace-panel__empty">
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
