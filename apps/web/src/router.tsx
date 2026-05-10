import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const routeMessageShell =
  'mx-auto max-w-lg rounded-[10px] border border-[rgba(255,139,139,0.3)] bg-[rgba(89,21,26,0.4)] p-6 text-[#ffd4d4]'

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultErrorComponent: () => (
      <div className={routeMessageShell}>
        <h1 className="m-0 text-xl font-semibold text-[var(--text)]">Route Error</h1>
        <p className="mt-2">The web application hit an unexpected routing error.</p>
      </div>
    ),
    defaultNotFoundComponent: () => (
      <div className={routeMessageShell}>
        <h1 className="m-0 text-xl font-semibold text-[var(--text)]">Not Found</h1>
        <p className="mt-2">The requested page does not exist.</p>
      </div>
    ),
    scrollRestoration: true,
  })
}
