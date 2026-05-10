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
    <div className="agent-toggle">
      <div>
        <p className="agent-toggle__label">Agent mode</p>
        <p className="agent-toggle__hint">
          Experimental orchestration boundary for future Composio integration.
        </p>
      </div>
      <label
        aria-disabled={disabled}
        className={`toggle ${disabled ? 'toggle--disabled' : ''}`}
      >
        <input
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span>{disabled ? 'Disabled' : checked ? 'On' : 'Off'}</span>
      </label>
    </div>
  )
}
