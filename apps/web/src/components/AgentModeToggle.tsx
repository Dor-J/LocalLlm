import { cn } from '~/lib/cn'

interface AgentModeToggleProps {
  checked: boolean
  disabled: boolean
  onChange: (value: boolean) => void
}

export function AgentModeToggle({
  checked,
  disabled,
  onChange,
}: AgentModeToggleProps) {
  return (
    <div className="flex flex-[1] items-center justify-between gap-4 rounded-[22px] border border-[color:var(--border)] bg-[var(--bg-panel)] p-4">
      <div>
        <p className="mb-1 font-semibold">Agent mode</p>
        <p className="m-0 text-[length:var(--text-sm)] text-[var(--text-muted)]">
          Experimental orchestration boundary for future Composio integration.
        </p>
      </div>
      <label
        aria-disabled={disabled}
        className={cn(
          'inline-flex cursor-pointer items-center gap-2',
          disabled && 'cursor-not-allowed opacity-70',
        )}
      >
        <input
          checked={checked}
          className="size-4"
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span>{disabled ? 'Disabled' : checked ? 'On' : 'Off'}</span>
      </label>
    </div>
  )
}
