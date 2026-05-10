## Web

TanStack Start and Vite frontend for the chat experience.

### Toolchain policy

This app tracks **TanStack Start** upstream, which currently pairs **Vite 8**, **TypeScript 6**, and a **Nitro 3 beta** runtime. Toolchain versions in `package.json` are pinned (no semver range) for `typescript`, `vite`, `nitro`, and `@vitejs/plugin-react` so installs stay reproducible; other packages may still use `^` where upgrades are low-risk. Revisit pins when upgrading TanStack Start or when adopting a stable Nitro 3 release.

It handles session browsing, message composition, model selection, conversation mode selection,
roleplay/task template selection, image attachments, and runtime status.

### What lives here

- `src/routes/` - application routes
- `src/components/` - chat UI, selectors, composer, and sidebar components
- `src/lib/` - API client and formatting helpers
- `src/styles/` - Tailwind entry (`app.css`), shared utility class fragments (`ui.ts`), and small global helpers (markdown wrapper, panel-toggle `:has` rules)
- `src/lib/cn.ts` - `clsx` + `tailwind-merge` helper for conditional classes
- `e2e/` - Playwright end-to-end tests

### Styling (Tailwind CSS v4)

- **Pipeline:** `tailwindcss` + `@tailwindcss/vite` are registered in `vite.config.ts`. Global tokens and base rules live in `src/styles/app.css` (`@import 'tailwindcss'`, `:root` variables, `@layer base`, markdown + panel-toggle extras). The root route imports that CSS as a side-effect so utilities are compiled for both client and SSR.
- **Breakpoint parity:** Layout still treats **980px** as the drawer vs three-column split (`max-[980px]:…` / `min-[981px]:…`), matching `matchMedia('(max-width: 980px)')` in the chat route.
- **Patterns:** Prefer Tailwind utilities in TSX; reuse shared strings from `src/styles/ui.ts` for buttons, shells, and inspector cards. Assistant markdown under `.message-md-body` keeps nested prose rules in CSS for parity.
- **Motion:** Micro-interactions use Tailwind `motion-safe:` / `motion-reduce:` variants. Modal open uses `.ui-dialog-motion` / `.ui-dialog-panel` keyframes in `app.css`; drawer scrim uses `.ui-drawer-scrim`; banners use `.ui-banner-motion`. **Reduced motion:** `prefers-reduced-motion: reduce` disables those animations and applies final backdrop/scrim/banner styles immediately.

### UI features

- **Layout:** The chat column uses a three-part structure (header and banners, scrollable messages + optional trace, footer) so the message list correctly fills the viewport height.
- **Session list:** On narrow viewports (max-width 980px), a **Chats** control in the chat header opens a slide-in drawer over a backdrop; the session list is inert when the drawer is closed. Desktop keeps the always-visible sidebar.
- **Inspector persistence:** Orchestration trace expanded state (and related panel visibility keys) are stored in `localStorage` under `local-llm:chat-panel-visibility` (`tracePanelExpanded`, `showCrewTemplatePanel`, etc.). Legacy objects without `tracePanelExpanded` default it to `false`.
- **Orchestration trace:** Shown as a one-line summary when collapsed; expand to view runs and steps. Traces are height-capped with internal scrolling.
- **Composer:** **Send** has an accessible name that includes the Ctrl+Enter / Cmd+Enter shortcut; after a successful send, focus returns to the message field.
- Session list and session switching; model and conversation mode selection (`Regular`, `Roleplay`, `Task`); crew template selection; image attachments for `gemma4:e2b`; health and runtime status; lazy session creation on first message; inline note when mode/template are locked after the first message in a session.

### Configuration

Key environment variables:

- `VITE_API_BASE_URL`
- `VITE_ENABLE_AGENT_MODE`

See `apps/web/.env.example` for the defaults.

### Local development

From `apps/web/`:

```bash
bun install
bun run dev
```

Other scripts:

```bash
bun run build
bun run preview
bun run test
bun run e2e
bun run lint
bun run format:check
```

### Notes

- The UI treats conversation mode and crew template as session-level settings once a session has messages.
- Regular chats use the direct Ollama flow.
- Roleplay and task chats surface the orchestration state through the same visible chat transcript.
