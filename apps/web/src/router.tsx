import { createRouter } from '@tanstack/react-router'
import { cn } from '~/lib/cn'
import { bannerError } from '~/styles/ui'
import { routeTree } from './routeTree.gen'

const routeMessageShell = cn(bannerError, 'mx-auto max-w-lg p-6')

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
