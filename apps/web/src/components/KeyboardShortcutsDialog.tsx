import { useEffect, useRef } from 'react'
import { cn } from '~/lib/cn'
import { btnPrimary, dialogBackdrop, dialogPanelShortcuts } from '~/styles/ui'

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
        el
          .querySelector<HTMLButtonElement>('[data-autofocus-target="shortcuts-close"]')
          ?.focus()
      })
    } else if (el.open) {
      el.close()
    }
  }, [open])

  const rowClass =
    'grid grid-cols-1 gap-x-4 gap-y-2 border-b border-[color:var(--border)] py-[0.45rem] text-[length:var(--text-sm)] last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]'
  const kbdClass =
    'inline-block rounded-md border border-[color:var(--border)] bg-[var(--bg-muted)] px-[0.38rem] py-[0.12rem] font-[inherit] text-[length:var(--text-xs)]'

  return (
    <dialog
      aria-labelledby="keyboard-shortcuts-title"
      className={dialogBackdrop}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      ref={dialogRef}
    >
      <div className={dialogPanelShortcuts}>
        <h2
          className="mb-[0.65rem] text-[length:var(--text-lg)]"
          id="keyboard-shortcuts-title"
        >
          Keyboard shortcuts
        </h2>
        <dl className="mb-[1.15rem]">
          <div className={rowClass}>
            <dt className="m-0 font-semibold text-[var(--text)]">Send message</dt>
            <dd className="m-0 text-[var(--text-muted)]">
              <kbd className={kbdClass}>Ctrl</kbd> + <kbd className={kbdClass}>Enter</kbd>{' '}
              (Windows/Linux) or <kbd className={kbdClass}>Cmd</kbd> +{' '}
              <kbd className={kbdClass}>Enter</kbd> (Mac)
            </dd>
          </div>
          <div className={rowClass}>
            <dt className="m-0 font-semibold text-[var(--text)]">New line in message</dt>
            <dd className="m-0 text-[var(--text-muted)]">
              <kbd className={kbdClass}>Shift</kbd> + <kbd className={kbdClass}>Enter</kbd>
            </dd>
          </div>
          <div className={rowClass}>
            <dt className="m-0 font-semibold text-[var(--text)]">Focus message field</dt>
            <dd className="m-0 text-[var(--text-muted)]">
              <kbd className={kbdClass}>Ctrl</kbd> + <kbd className={kbdClass}>.</kbd> or{' '}
              <kbd className={kbdClass}>Cmd</kbd> + <kbd className={kbdClass}>.</kbd>
            </dd>
          </div>
          <div className={rowClass}>
            <dt className="m-0 font-semibold text-[var(--text)]">
              Toggle session list / sidebar
            </dt>
            <dd className="m-0 text-[var(--text-muted)]">
              <kbd className={kbdClass}>Ctrl</kbd> + <kbd className={kbdClass}>Shift</kbd> +{' '}
              <kbd className={kbdClass}>C</kbd> or <kbd className={kbdClass}>Cmd</kbd> +{' '}
              <kbd className={kbdClass}>Shift</kbd> + <kbd className={kbdClass}>C</kbd>
            </dd>
          </div>
          <div className={rowClass}>
            <dt className="m-0 font-semibold text-[var(--text)]">Show this dialog</dt>
            <dd className="m-0 text-[var(--text-muted)]">
              <kbd className={kbdClass}>Ctrl</kbd> + <kbd className={kbdClass}>/</kbd> or{' '}
              <kbd className={kbdClass}>Cmd</kbd> + <kbd className={kbdClass}>/</kbd>
            </dd>
          </div>
        </dl>
        <button
          className={cn(btnPrimary, 'w-full')}
          data-autofocus-target="shortcuts-close"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>
    </dialog>
  )
}
