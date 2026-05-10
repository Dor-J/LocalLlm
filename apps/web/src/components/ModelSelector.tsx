import { SUPPORTED_MODELS, type ChatModel } from '@local/shared'

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
    <fieldset className="model-selector" disabled={disabled}>
      <legend>Model</legend>
      <div className="model-selector__options" role="radiogroup">
        {SUPPORTED_MODELS.map((model) => (
          <label className="model-option" key={model}>
            <input
              checked={selectedModel === model}
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
