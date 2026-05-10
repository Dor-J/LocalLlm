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
