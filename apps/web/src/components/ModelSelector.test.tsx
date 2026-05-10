import { SUPPORTED_MODELS } from '@local/shared'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModelSelector } from './ModelSelector'

describe('ModelSelector', () => {
  it('renders the supported radio options and changes selection', () => {
    const onChange = vi.fn()

    render(
      <ModelSelector onChange={onChange} selectedModel={SUPPORTED_MODELS[0]} />,
    )

    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(screen.getByDisplayValue('qwen3.5:2b')).toBeChecked()
    expect(screen.getByDisplayValue('gemma4:e2b')).not.toBeChecked()
    expect(
      screen.getByDisplayValue('gemma4-e2b-uncensored-q5_k_p'),
    ).not.toBeChecked()

    fireEvent.click(screen.getByDisplayValue('gemma4:e2b'))
    expect(onChange).toHaveBeenCalledWith('gemma4:e2b')
  })
})
