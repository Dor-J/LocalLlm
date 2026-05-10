/**
 * Light load smoke: health, paginated chats list, optional completions.
 *
 * Usage (install k6 from https://k6.io/):
 *   k6 run -e BASE_URL=http://localhost:8000/api/v1 scripts/perf/k6-api-smoke.js
 *
 * Optional chat session for POST completions (set after creating a session):
 *   k6 run -e BASE_URL=http://localhost:8000/api/v1 -e SESSION_ID=<uuid> scripts/perf/k6-api-smoke.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 3,
  duration: '20s',
  thresholds: {
    http_req_failed: ['rate<0.1'],
    http_req_duration: ['p(95)<3000'],
  },
}

const base = __ENV.BASE_URL || 'http://localhost:8000/api/v1'
const sessionId = __ENV.SESSION_ID || ''

export default function () {
  const health = http.get(`${base}/health`)
  check(health, { 'health 200': (r) => r.status === 200 })

  const chats = http.get(`${base}/chats?limit=50&offset=0`)
  check(chats, { 'chats 200': (r) => r.status === 200 })

  if (sessionId) {
    const complete = http.post(
      `${base}/chats/${sessionId}/completions`,
      JSON.stringify({
        content: 'ping',
        selectedModel: 'qwen3.5:2b',
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
    check(complete, { 'completions 2xx or 4xx': (r) => r.status >= 200 && r.status < 500 })
  }

  sleep(0.3)
}
