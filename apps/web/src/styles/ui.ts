/**
 * Shared Tailwind class fragments for consistent buttons, chips, and shells.
 * Design tokens remain CSS variables on `:root` in app.css.
 */

export const btnPrimary =
  'inline-flex items-center justify-center gap-[0.45rem] rounded-lg border-0 ' +
  'bg-gradient-to-br from-[var(--accent)] to-[#b2fff0] px-[0.85rem] py-[0.68rem] ' +
  'font-semibold text-[#0a1517] disabled:cursor-not-allowed disabled:opacity-65'

export const btnSecondary =
  'inline-flex items-center justify-center gap-[0.45rem] rounded-lg border ' +
  'border-[color:var(--border)] bg-[var(--bg-muted)] px-[0.78rem] py-[0.6rem] ' +
  'font-semibold text-[var(--text)] no-underline ' +
  'disabled:cursor-not-allowed disabled:opacity-65'

export const btnIcon =
  'inline-grid size-[2.35rem] shrink-0 place-items-center rounded-lg border ' +
  'border-[color:var(--border)] bg-[var(--bg-muted)] text-[var(--text)] ' +
  'disabled:cursor-not-allowed disabled:opacity-65'

export const btnIconPrimary =
  'border-0 bg-gradient-to-br from-[var(--accent)] to-[#b2fff0] text-[#071112]'

export const eyebrow =
  'mb-1 text-[length:var(--text-xs)] uppercase tracking-[0.16em] text-[var(--text-muted)]'

export const elevatedShell =
  'min-h-0 border border-[color:var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow)] ' +
  'supports-[backdrop-filter]:backdrop-blur-[22px] motion-reduce:backdrop-blur-none'

/** Rounded elevated column chrome shared by chat sidebar and inspector (gap added per panel). */
export const elevatedAsideChrome =
  `${elevatedShell} flex min-h-0 flex-col overflow-hidden rounded-2xl p-4`

/** Main chat column: elevated surface, scroll shell, narrow viewport height cap. */
export const chatPanelShell =
  `${elevatedShell} flex min-h-0 flex-col gap-3 overflow-hidden rounded-2xl p-[0.9rem] ` +
  'max-[980px]:h-[calc(100dvh-1.5rem)]'

export const inspectorSectionShell =
  'flex flex-col gap-3 rounded-xl border border-[color:var(--border)] ' +
  'bg-[rgba(81,97,126,0.1)] p-[0.85rem]'

export const statusPillBase =
  'rounded-full border border-[color:var(--border)] bg-[var(--bg-muted)] ' +
  'px-[0.55rem] py-[0.22rem] text-[length:var(--text-sm)] text-[var(--text-muted)]'

export const statusPillOk =
  'border-[rgba(126,215,193,0.38)] text-[#c8fff3]'

export const statusPillWarn =
  'border-[rgba(255,139,139,0.32)] text-[#ffd4d4]'

/** Inline error / destructive advisory (chat page, roleplays). */
export const bannerError =
  'rounded-[10px] border border-[rgba(255,139,139,0.3)] bg-[rgba(89,21,26,0.4)] px-4 py-[0.95rem] text-[#ffd4d4]'

/** Non-error advisory (runtime status, loading hints). */
export const bannerWarning =
  'rounded-[10px] border border-[rgba(255,201,107,0.28)] bg-[rgba(83,57,19,0.34)] px-4 py-[0.95rem] text-[#ffe6b3]'

/** Compact error strip inside orchestration trace (matches prior radius/padding). */
export const traceErrorBanner =
  'rounded-[18px] border border-[rgba(255,139,139,0.3)] bg-[rgba(89,21,26,0.3)] px-[0.9rem] py-[0.8rem] text-[0.86rem] leading-[1.5] text-[#ffd4d4]'

/** Native `<dialog>` chrome: transparent sheet + dimmed backdrop. */
export const dialogBackdrop =
  'max-w-[calc(100vw-2rem)] border-0 bg-transparent p-0 backdrop:bg-black/55'

/** Inner panel for confirm-style modals. */
export const dialogPanelConfirm =
  'min-w-[min(22rem,100%)] max-w-[min(28rem,100%)] rounded-[14px] border border-[color:var(--border-strong)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow)]'

/** Inner panel for keyboard shortcuts (narrower max width). */
export const dialogPanelShortcuts =
  'min-w-[min(22rem,100%)] max-w-[min(26rem,100%)] rounded-[14px] border border-[color:var(--border-strong)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow)]'

/** Shared narrow-drawer positioning (attach left or right variant + open state). */
export const drawerSheetBase =
  'max-[980px]:fixed max-[980px]:bottom-0 max-[980px]:top-0 max-[980px]:z-40 max-[980px]:m-0 max-[980px]:h-[100dvh] max-[980px]:max-h-[100dvh] max-[980px]:w-[min(20rem,92vw)] max-[980px]:pointer-events-none max-[980px]:transition-transform max-[980px]:duration-[220ms] max-[980px]:ease-out'

/** Sessions rail: slides from the left. */
export const drawerSheetLeft =
  `${drawerSheetBase} max-[980px]:left-0 max-[980px]:rounded-br-[14px] max-[980px]:rounded-tr-[14px] max-[980px]:-translate-x-full`

/** Inspector rail: slides from the right. */
export const drawerSheetRight =
  `${drawerSheetBase} max-[980px]:right-0 max-[980px]:rounded-bl-[14px] max-[980px]:rounded-tl-[14px] max-[980px]:translate-x-full`

/** Narrow viewport: drawer is interactive and fully visible. */
export const drawerSheetOpen =
  'max-[980px]:translate-x-0 max-[980px]:pointer-events-auto'

/** Selected radios and trace runs (subtle accent wash). */
export const surfaceSelectedSoft =
  'border-[rgba(126,215,193,0.38)] bg-gradient-to-br from-[rgba(126,215,193,0.12)] to-[rgba(23,31,46,0.95)]'

/** Active conversation card, roleplay template row (stronger accent wash). */
export const surfaceSelectedStrong =
  'border-[var(--accent-strong)] bg-gradient-to-br from-[rgba(126,215,193,0.18)] to-[rgba(23,31,46,0.95)]'

/** User message bubble accent border + gradient. */
export const surfaceUserBubble =
  'border-[rgba(126,215,193,0.32)] bg-gradient-to-br from-[rgba(126,215,193,0.14)] to-[var(--bg-panel)]'

/** Stacked label + control spacing (roleplays forms). */
export const formFieldStack = 'flex flex-col gap-[0.45rem]'

/** Shared text field chrome for roleplays editor. */
export const formControl =
  'w-full rounded-[18px] border border-[color:var(--border)] bg-[rgba(11,16,26,0.74)] px-[0.9rem] py-[0.8rem] text-[var(--text)]'

export const formTextarea = `${formControl} min-h-[120px] resize-y`

export const formTextareaCompact = `${formControl} min-h-[88px] resize-y`

export const formTextareaCode =
  `${formControl} min-h-[220px] resize-y font-[Consolas,Courier_New,monospace]`

/** Roleplays section / role editor card shell. */
export const surfaceCardRoleplay =
  'rounded-[24px] border border-[color:var(--border)] bg-[var(--bg-panel)] p-4'

/** Inactive template row in roleplays sidebar list. */
export const roleplayTemplateCard =
  'flex w-full flex-col gap-[0.3rem] rounded-[20px] border border-[color:var(--border)] bg-[var(--bg-panel)] px-4 py-[0.9rem] text-left text-inherit'
