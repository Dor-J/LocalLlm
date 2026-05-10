import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultErrorComponent: () => (
      <div className="route-error">
        <h1>Route Error</h1>
        <p>The web application hit an unexpected routing error.</p>
      </div>
    ),
    defaultNotFoundComponent: () => (
      <div className="route-error">
        <h1>Not Found</h1>
        <p>The requested page does not exist.</p>
      </div>
    ),
    scrollRestoration: true,
  })
}
