import { SUPPORTED_MODELS, type ChatModel } from '@local/shared'
import { cn } from '~/lib/cn'

interface ModelSelectorProps {
  disabled?: boolean
  selectedModel: ChatModel
  onChange: (model: ChatModel) => void
}

export function ModelSelector({
  disabled = false,
  selectedModel,
  onChange,
}: ModelSelectorProps) {
  return (
    <fieldset className="m-0 min-w-0 border-0 bg-transparent p-0" disabled={disabled}>
      <legend>Model</legend>
      <div className="mt-3 flex flex-wrap gap-3" role="radiogroup">
        {SUPPORTED_MODELS.map((model) => (
          <label
            className={cn(
              'flex cursor-pointer items-center gap-[0.45rem] rounded-lg border border-[color:var(--border)] bg-[var(--bg-muted)] px-[0.65rem] py-2',
            )}
            key={model}
          >
            <input
              checked={selectedModel === model}
              className="size-4 shrink-0"
              name="selectedModel"
              onChange={() => onChange(model)}
              type="radio"
              value={model}
            />
            <span>{model}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
