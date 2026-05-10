import type { ImageAssetSummary } from '@local/shared'
import { forwardRef, useId, useRef } from 'react'

export interface MessageComposerProps {
  disabled?: boolean
  disabledReason?: string | null
  attachments?: ImageAssetSummary[]
  allowImageUpload?: boolean
  isUploadingImage?: boolean
  draft: string
  onChange: (value: string) => void
  onUploadFile?: (file: File) => void
  onRemoveAttachment?: (attachmentId: string) => void
  onSubmit: () => void
}

export const MESSAGE_COMPOSER_SEND_LABEL = 'Send'

/**
 * Chat composer with optional image attachments and Ctrl/Cmd+Enter to send.
 * Forwards ref to the message textarea for focus management after send.
 */
/**
 * Message field with optional image attachments, Ctrl/Cmd+Enter to send, and
 * the send control labeled for assistive technology.
 */
export const MessageComposer = forwardRef<
  HTMLTextAreaElement,
  MessageComposerProps
>(function MessageComposer(
  {
    disabled = false,
    disabledReason = null,
    attachments = [],
    allowImageUpload = false,
    isUploadingImage = false,
    draft,
    onChange,
    onUploadFile,
    onRemoveAttachment,
    onSubmit,
  },
  forwardedRef,
) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const defaultId = useId()
  const hintId = `${defaultId}-hint`
  const disabledId = `${defaultId}-disabled`
  const uploadInputId = `${defaultId}-upload`
  const shortcutHint =
    'Enter = new line · Ctrl+Enter or Cmd+Enter = send · Ctrl+V = paste image'
  const describedBy = [hintId, disabledReason ? disabledId : undefined]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="composer">
      {attachments.length > 0 ? (
        <div className="composer__attachments" aria-label="Attached images">
          {attachments.map((attachment) => (
            <article className="attachment-card" key={attachment.id}>
              <img
                alt={attachment.fileName}
                className="attachment-card__preview"
                src={attachment.contentUrl}
              />
              <div className="attachment-card__body">
                <p className="attachment-card__name">{attachment.fileName}</p>
                <p className="attachment-card__meta">
                  {Math.ceil(attachment.byteSize / 1024)} KB
                </p>
              </div>
              {onRemoveAttachment ? (
                <button
                  className="attachment-card__remove"
                  onClick={() => onRemoveAttachment(attachment.id)}
                  type="button"
                >
                  Remove
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      <textarea
        aria-describedby={describedBy}
        className="composer__input"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            (event.ctrlKey || event.metaKey) &&
            !event.shiftKey
          ) {
            event.preventDefault()
            onSubmit()
          }
        }}
        onPaste={(event) => {
          if (!allowImageUpload || !onUploadFile) {
            return
          }

          const clipboard = event.clipboardData
          const pastedImages = getPastedImageFiles(clipboard)

          if (pastedImages.length === 0) {
            return
          }

          event.preventDefault()

          for (const file of pastedImages) {
            onUploadFile(file)
          }
        }}
        placeholder="Ask something about the local stack, data, or your docs..."
        ref={forwardedRef}
        rows={4}
        value={draft}
      />
      <div className="composer__actions">
        {allowImageUpload && onUploadFile ? (
          <>
            <input
              accept="image/*"
              aria-hidden="true"
              className="composer__file-input"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                for (const file of files) {
                  onUploadFile(file)
                }
                event.currentTarget.value = ''
              }}
              id={uploadInputId}
              ref={fileInputRef}
              tabIndex={-1}
              type="file"
            />
            <button
              aria-controls={uploadInputId}
              className="secondary-button"
              disabled={disabled || isUploadingImage}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              {isUploadingImage ? 'Uploading...' : 'Upload image'}
            </button>
          </>
        ) : null}
        <button
          aria-label="Send (use Ctrl+Enter or Cmd+Enter to send from the keyboard)"
          className="primary-button composer__send"
          disabled={disabled || draft.trim().length === 0}
          onClick={onSubmit}
          title="Ctrl+Enter or Cmd+Enter to send"
          type="button"
        >
          {MESSAGE_COMPOSER_SEND_LABEL}
        </button>
      </div>
      <p className="composer__hint" id={hintId}>
        {shortcutHint}
      </p>
      {disabledReason ? (
        <p
          aria-live="polite"
          className="composer__hint composer__hint--disabled"
          id={disabledId}
        >
          {disabledReason}
        </p>
      ) : null}
    </div>
  )
})

function getPastedImageFiles(clipboardData: DataTransfer) {
  const files: File[] = []

  for (const item of Array.from(clipboardData.items)) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) {
      continue
    }

    const file = item.getAsFile()
    if (file) {
      files.push(normalizePastedImageFile(file))
    }
  }

  if (files.length > 0) {
    return files
  }

  for (const file of Array.from(clipboardData.files)) {
    if (!file.type.startsWith('image/')) {
      continue
    }

    files.push(normalizePastedImageFile(file))
  }

  return files
}

function normalizePastedImageFile(file: File) {
  if (file.name) {
    return file
  }

  const extension = file.type === 'image/jpeg' ? 'jpg' : 'png'
  return new File([file], `pasted-image-${Date.now()}.${extension}`, {
    type: file.type || 'image/png',
    lastModified: file.lastModified || Date.now(),
  })
}
