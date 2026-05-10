import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConversationModeSelector } from './ConversationModeSelector'

describe('ConversationModeSelector', () => {
  it('renders the supported modes and changes selection', () => {
    const onChange = vi.fn()

    render(
      <ConversationModeSelector mode="regular" onChange={onChange} />,
    )

    expect(screen.getAllByRole('radio')).toHaveLength(3)
    fireEvent.click(screen.getByDisplayValue('roleplay'))
    expect(onChange).toHaveBeenCalledWith('roleplay')
  })
})

