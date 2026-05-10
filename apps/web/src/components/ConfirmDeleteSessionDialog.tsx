import { useEffect, useRef } from 'react'

export interface ConfirmDeleteSessionDialogProps {
  /** When set, the dialog is shown for this session title (fallback "Untitled conversation"). */
  sessionTitle: string | null
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Modal confirmation before deleting a chat session. Uses the native `<dialog>`
 * for focus management and Escape handling.
 */
export function ConfirmDeleteSessionDialog({
  sessionTitle,
  onConfirm,
  onCancel,
}: ConfirmDeleteSessionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const open = sessionTitle !== null

  useEffect(() => {
    const el = dialogRef.current
    if (!el) {
      return
    }
    if (open) {
      if (!el.open) {
        el.showModal()
      }
      queueMicrotask(() => {
        el.querySelector<HTMLButtonElement>('.confirm-dialog__confirm')?.focus()
      })
    } else if (el.open) {
      el.close()
    }
  }, [open])

  const title = sessionTitle ?? ''

  return (
    <dialog
      aria-describedby="confirm-delete-session-desc"
      aria-labelledby="confirm-delete-session-title"
      className="confirm-dialog"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      ref={dialogRef}
    >
      <div className="confirm-dialog__panel">
        <h2 className="confirm-dialog__title" id="confirm-delete-session-title">
          Delete conversation?
        </h2>
        <p className="confirm-dialog__body" id="confirm-delete-session-desc">
          This will permanently remove{' '}
          <strong>{title || 'Untitled conversation'}</strong> and its messages.
          This cannot be undone.
        </p>
        <div className="confirm-dialog__actions">
          <button
            className="secondary-button"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="primary-button confirm-dialog__confirm"
            onClick={onConfirm}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>
    </dialog>
  )
}
