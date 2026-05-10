import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'bun run dev -- --host 127.0.0.1 --port 3000',
    cwd: '.',
    env: {
      VITE_API_BASE_URL: 'http://127.0.0.1:8001/api/v1',
      VITE_ENABLE_AGENT_MODE: 'false',
    },
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
