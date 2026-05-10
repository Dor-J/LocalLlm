import type { ConversationMode } from '@local/shared'
import { CONVERSATION_MODES } from '@local/shared'

interface ConversationModeSelectorProps {
  disabled?: boolean
  mode: ConversationMode
  onChange: (mode: ConversationMode) => void
}

const MODE_DETAILS: Record<
  ConversationMode,
  { label: string; description: string }
> = {
  regular: {
    label: 'Regular',
    description: 'Single-model chat with no delegation.',
  },
  roleplay: {
    label: 'Roleplay',
    description: 'Structured turn-taking and scene continuity.',
  },
  task: {
    label: 'Task',
    description: 'Manager-led research and synthesis workflows.',
  },
}

export function ConversationModeSelector({
  disabled = false,
  mode,
  onChange,
}: ConversationModeSelectorProps) {
  return (
    <fieldset className="mode-selector" disabled={disabled}>
      <legend>Conversation mode</legend>
      <div className="mode-selector__options" role="radiogroup">
        {CONVERSATION_MODES.map((option) => {
          const details = MODE_DETAILS[option]
          const active = mode === option
          return (
            <label
              className={`mode-option ${active ? 'mode-option--active' : ''}`}
              key={option}
            >
              <input
                checked={active}
                name="conversationMode"
                onChange={() => onChange(option)}
                type="radio"
                value={option}
              />
              <span className="mode-option__label">{details.label}</span>
              <span className="mode-option__hint">{details.description}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

