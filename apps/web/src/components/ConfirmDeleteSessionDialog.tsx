import { useEffect, useRef } from 'react'
import { cn } from '~/lib/cn'
import { btnPrimary, btnSecondary } from '~/styles/ui'

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
        el
          .querySelector<HTMLButtonElement>('[data-autofocus-target="confirm-delete"]')
          ?.focus()
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
      className="max-w-[calc(100vw-2rem)] border-0 bg-transparent p-0 backdrop:bg-black/55"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      ref={dialogRef}
    >
      <div
        className={cn(
          'min-w-[min(22rem,100%)] max-w-[min(28rem,100%)] rounded-[14px] border border-[color:var(--border-strong)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow)]',
        )}
      >
        <h2
          className="mb-[0.65rem] text-[length:var(--text-lg)]"
          id="confirm-delete-session-title"
        >
          Delete conversation?
        </h2>
        <p
          className="mb-[1.15rem] text-[length:var(--text-base)] leading-[1.55] text-[var(--text-muted)]"
          id="confirm-delete-session-desc"
        >
          This will permanently remove{' '}
          <strong className="text-[var(--text)]">{title || 'Untitled conversation'}</strong>{' '}
          and its messages. This cannot be undone.
        </p>
        <div className="flex flex-wrap justify-end gap-[0.65rem]">
          <button className={btnSecondary} onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className={btnPrimary}
            data-autofocus-target="confirm-delete"
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
