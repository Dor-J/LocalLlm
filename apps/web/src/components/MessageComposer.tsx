import type { ImageAssetSummary } from '@local/shared'
import { ImagePlus, SendHorizontal, X } from 'lucide-react'
import {
  forwardRef,
  useCallback,
  useId,
  useRef,
  type ForwardedRef,
  type MutableRefObject,
} from 'react'

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
  onClear?: () => void
  onSubmit: (value: string) => void
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
    onClear,
    onSubmit,
  },
  forwardedRef,
) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const defaultId = useId()
  const inputId = `${defaultId}-input`
  const hintId = `${defaultId}-hint`
  const disabledId = `${defaultId}-disabled`
  const uploadInputId = `${defaultId}-upload`
  const shortcutHint =
    'Enter sends, Shift+Enter adds a new line, Ctrl+V pastes an image.'
  const describedBy = [hintId, disabledReason ? disabledId : undefined]
    .filter(Boolean)
    .join(' ')
  const assignTextareaRef = useMergedTextareaRef(forwardedRef, textareaRef)

  const submitCurrentValue = useCallback(() => {
    const input =
      textareaRef.current ??
      (document.getElementById(inputId) as HTMLTextAreaElement | null)
    const value = input?.value ?? draft
    if (!disabled && value.trim().length > 0) {
      onSubmit(value)
    }
  }, [disabled, draft, inputId, onSubmit])

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
                  aria-label={`Remove ${attachment.fileName}`}
                  className="icon-button attachment-card__remove"
                  onClick={() => onRemoveAttachment(attachment.id)}
                  type="button"
                >
                  <X aria-hidden size={16} />
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
        id={inputId}
        onChange={(event) => onChange(event.target.value)}
        onInput={(event) => {
          onChange(event.currentTarget.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            const value = event.currentTarget.value
            if (!disabled && value.trim().length > 0) {
              onSubmit(value)
            }
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
        ref={assignTextareaRef}
        rows={4}
        value={draft}
      />
      <div className="composer__actions">
        {onClear && draft.length > 0 ? (
          <button
            aria-label="Clear draft"
            className="icon-button"
            disabled={disabled}
            onClick={onClear}
            title="Clear draft"
            type="button"
          >
            <X aria-hidden size={18} />
          </button>
        ) : null}
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
              aria-label={isUploadingImage ? 'Uploading image' : 'Upload image'}
              className="icon-button"
              disabled={disabled || isUploadingImage}
              onClick={() => fileInputRef.current?.click()}
              title={isUploadingImage ? 'Uploading...' : 'Upload image'}
              type="button"
            >
              <ImagePlus aria-hidden size={18} />
            </button>
          </>
        ) : null}
        <button
          aria-label="Send message"
          aria-disabled={disabled}
          className="icon-button icon-button--primary composer__send"
          disabled={disabled}
          onClick={submitCurrentValue}
          title="Send message"
          type="button"
        >
          <SendHorizontal aria-hidden size={19} />
          <span className="visually-hidden">{MESSAGE_COMPOSER_SEND_LABEL}</span>
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

function useMergedTextareaRef(
  forwardedRef: ForwardedRef<HTMLTextAreaElement>,
  localRef: MutableRefObject<HTMLTextAreaElement | null>,
) {
  return useCallback(
    (node: HTMLTextAreaElement | null) => {
      localRef.current = node
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
        return
      }
      if (forwardedRef) {
        forwardedRef.current = node
      }
    },
    [forwardedRef, localRef],
  )
}

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
