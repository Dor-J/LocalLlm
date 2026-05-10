import type { CrewTemplateId, ConversationMode } from '@local/shared'
import { cn } from '~/lib/cn'
import { surfaceSelectedSoft } from '~/styles/ui'

interface CrewTemplateSelectorProps {
  disabled?: boolean
  mode: ConversationMode
  templateId: CrewTemplateId | null
  onChange: (templateId: CrewTemplateId | null) => void
}

const ROLEPLAY_TEMPLATES: Array<{
  id: CrewTemplateId
  label: string
  description: string
  mode: ConversationMode
}> = [
  {
    id: 'roleplay-fantasy',
    label: 'Fantasy',
    description: 'Narrated scene with continuity control.',
    mode: 'roleplay',
  },
  {
    id: 'roleplay-debate',
    label: 'Debate',
    description: 'Disciplined back-and-forth dialogue.',
    mode: 'roleplay',
  },
  {
    id: 'research-assistant',
    label: 'Research',
    description: 'Manager-led research and planning.',
    mode: 'task',
  },
]

export function CrewTemplateSelector({
  disabled = false,
  mode,
  templateId,
  onChange,
}: CrewTemplateSelectorProps) {
  const templates = ROLEPLAY_TEMPLATES.filter((template) => template.mode === mode)

  if (mode === 'regular') {
    return null
  }

  return (
    <fieldset className="m-0 min-w-0 border-0 bg-transparent p-0 max-[980px]:min-w-0" disabled={disabled}>
      <legend>Template</legend>
      <div className="mt-3 flex flex-wrap gap-3" role="radiogroup">
        {templates.map((template) => {
          const active = templateId === template.id
          return (
            <label
              className={cn(
                'flex min-w-0 flex-[1_1_180px] cursor-pointer flex-col items-start gap-[0.45rem] rounded-lg border border-[color:var(--border)] bg-[var(--bg-muted)] px-[0.65rem] py-2',
                active && surfaceSelectedSoft,
              )}
              key={template.id}
            >
              <input
                checked={active}
                className="size-4 shrink-0 self-start"
                name="crewTemplateId"
                onChange={() => onChange(template.id)}
                type="radio"
                value={template.id}
              />
              <span className="font-semibold">{template.label}</span>
              <span className="text-[0.82rem] leading-[1.4] text-[var(--text-muted)]">
                {template.description}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
