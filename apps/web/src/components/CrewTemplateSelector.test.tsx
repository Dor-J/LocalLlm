import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CrewTemplateSelector } from './CrewTemplateSelector'

describe('CrewTemplateSelector', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows roleplay templates for roleplay mode', () => {
    const onChange = vi.fn()

    render(
      <CrewTemplateSelector
        mode="roleplay"
        onChange={onChange}
        templateId="roleplay-fantasy"
      />,
    )

    expect(screen.getAllByRole('radio')).toHaveLength(2)
    fireEvent.click(screen.getByDisplayValue('roleplay-debate'))
    expect(onChange).toHaveBeenCalledWith('roleplay-debate')
  })

  it('shows the research template for task mode', () => {
    const onChange = vi.fn()

    render(
      <CrewTemplateSelector
        mode="task"
        onChange={onChange}
        templateId="research-assistant"
      />,
    )

    expect(screen.getAllByRole('radio')).toHaveLength(1)
  })
})
