import type { ConversationMode } from '@local/shared'
import { CONVERSATION_MODES } from '@local/shared'
import { cn } from '~/lib/cn'
import { surfaceSelectedSoft } from '~/styles/ui'

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
    <fieldset className="m-0 min-w-0 border-0 bg-transparent p-0 max-[980px]:min-w-0" disabled={disabled}>
      <legend>Conversation mode</legend>
      <div className="mt-3 flex flex-wrap gap-3" role="radiogroup">
        {CONVERSATION_MODES.map((option) => {
          const details = MODE_DETAILS[option]
          const active = mode === option
          return (
            <label
              className={cn(
                'flex min-w-0 flex-[1_1_180px] cursor-pointer flex-col items-start gap-[0.45rem] rounded-lg border border-[color:var(--border)] bg-[var(--bg-muted)] px-[0.65rem] py-2 motion-safe:transition-[border-color,background-color,transform] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)] motion-safe:hover:border-[color:var(--border-strong)] motion-safe:active:scale-[0.99]',
                active && surfaceSelectedSoft,
              )}
              key={option}
            >
              <input
                checked={active}
                className="size-4 shrink-0 self-start"
                name="conversationMode"
                onChange={() => onChange(option)}
                type="radio"
                value={option}
              />
              <span className="font-semibold">{details.label}</span>
              <span className="text-[0.82rem] leading-[1.4] text-[var(--text-muted)]">
                {details.description}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
