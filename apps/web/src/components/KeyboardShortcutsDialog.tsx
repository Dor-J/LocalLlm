import { useEffect, useRef } from 'react'

export interface KeyboardShortcutsDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * Modal listing keyboard shortcuts; uses `<dialog>` like delete confirmation.
 */
export function KeyboardShortcutsDialog({
  open,
  onClose,
}: KeyboardShortcutsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

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
        el.querySelector<HTMLButtonElement>('.keyboard-shortcuts-dialog__close')?.focus()
      })
    } else if (el.open) {
      el.close()
    }
  }, [open])

  return (
    <dialog
      aria-labelledby="keyboard-shortcuts-title"
      className="keyboard-shortcuts-dialog"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      ref={dialogRef}
    >
      <div className="keyboard-shortcuts-dialog__panel">
        <h2 className="keyboard-shortcuts-dialog__title" id="keyboard-shortcuts-title">
          Keyboard shortcuts
        </h2>
        <dl className="keyboard-shortcuts-dialog__list">
          <div className="keyboard-shortcuts-dialog__row">
            <dt>Send message</dt>
            <dd>
              <kbd>Ctrl</kbd> + <kbd>Enter</kbd> (Windows/Linux) or{' '}
              <kbd>Cmd</kbd> + <kbd>Enter</kbd> (Mac)
            </dd>
          </div>
          <div className="keyboard-shortcuts-dialog__row">
            <dt>New line in message</dt>
            <dd>
              <kbd>Shift</kbd> + <kbd>Enter</kbd>
            </dd>
          </div>
          <div className="keyboard-shortcuts-dialog__row">
            <dt>Focus message field</dt>
            <dd>
              <kbd>Ctrl</kbd> + <kbd>.</kbd> or <kbd>Cmd</kbd> + <kbd>.</kbd>
            </dd>
          </div>
          <div className="keyboard-shortcuts-dialog__row">
            <dt>Toggle session list / sidebar</dt>
            <dd>
              <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd> or{' '}
              <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd>
            </dd>
          </div>
          <div className="keyboard-shortcuts-dialog__row">
            <dt>Show this dialog</dt>
            <dd>
              <kbd>Ctrl</kbd> + <kbd>/</kbd> or <kbd>Cmd</kbd> + <kbd>/</kbd>
            </dd>
          </div>
        </dl>
        <button
          className="primary-button keyboard-shortcuts-dialog__close"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>
    </dialog>
  )
}
