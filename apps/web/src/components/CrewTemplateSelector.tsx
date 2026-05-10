import type { CrewTemplateId, ConversationMode } from '@local/shared'

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
    <fieldset className="template-selector" disabled={disabled}>
      <legend>Template</legend>
      <div className="template-selector__options" role="radiogroup">
        {templates.map((template) => {
          const active = templateId === template.id
          return (
            <label
              className={`template-option ${
                active ? 'template-option--active' : ''
              }`}
              key={template.id}
            >
              <input
                checked={active}
                name="crewTemplateId"
                onChange={() => onChange(template.id)}
                type="radio"
                value={template.id}
              />
              <span className="template-option__label">{template.label}</span>
              <span className="template-option__hint">
                {template.description}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

