import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MessageComposer } from './MessageComposer'

describe('MessageComposer', () => {
  afterEach(() => {
    cleanup()
  })

  it('submits on plain Enter', () => {
    const onSubmit = vi.fn()

    render(
      <MessageComposer
        draft="hello"
        onChange={() => undefined}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.keyDown(screen.getByRole('textbox'), {
      key: 'Enter',
      code: 'Enter',
    })

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('keeps Shift+Enter for new lines', () => {
    const onSubmit = vi.fn()

    render(
      <MessageComposer
        draft="hello"
        onChange={() => undefined}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.keyDown(screen.getByRole('textbox'), {
      key: 'Enter',
      code: 'Enter',
      shiftKey: true,
    })

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not submit blank drafts', () => {
    const onSubmit = vi.fn()
    render(
      <MessageComposer
        draft="   "
        onChange={() => undefined}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders a disabled reason when provided', () => {
    render(
      <MessageComposer
        disabled
        disabledReason="Ollama is not running."
        draft=""
        onChange={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    expect(screen.getByText('Ollama is not running.')).toBeVisible()
  })

  it('shows the image upload button when enabled', () => {
    render(
      <MessageComposer
        allowImageUpload
        draft=""
        onChange={() => undefined}
        onUploadFile={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: 'Upload image' })).toBeVisible()
  })

  it('clears the draft through the clear action', () => {
    const onClear = vi.fn()

    render(
      <MessageComposer
        draft="saved text"
        onChange={() => undefined}
        onClear={onClear}
        onSubmit={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Clear draft' }))

    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('uploads pasted images when image upload is enabled', () => {
    const onUploadFile = vi.fn()
    const file = new File([new Uint8Array([1, 2, 3])], 'pasted.png', {
      type: 'image/png',
    })

    render(
      <MessageComposer
        allowImageUpload
        draft=""
        onChange={() => undefined}
        onSubmit={() => undefined}
        onUploadFile={onUploadFile}
      />,
    )

    const clipboardData = {
      getData: vi.fn(() => ''),
      files: [file],
      items: [
        {
          kind: 'file',
          type: 'image/png',
          getAsFile: () => file,
        },
      ],
    }

    fireEvent.paste(screen.getByRole('textbox'), { clipboardData })

    expect(onUploadFile).toHaveBeenCalledWith(file)
  })
})
