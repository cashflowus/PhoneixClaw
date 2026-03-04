/**
 * Frontend error reporting: reportError(), deduplication, batching.
 * POSTs to /api/v2/error-logs. Used by ErrorBoundary, global handlers, React Query.
 */

import api from '@/lib/api'

const DEDUPE_WINDOW_MS = 60_000
const BATCH_INTERVAL_MS = 5_000
const BATCH_MAX = 10

interface ErrorContext {
  source?: string
  component?: string
  componentStack?: string
  url?: string
  userAgent?: string
  viewport?: string
  route?: string
  userId?: string
}

const recentFingerprints = new Set<string>()
const queue: Array<{ error: Error; context: ErrorContext }> = []
let batchTimer: ReturnType<typeof setTimeout> | null = null

function fingerprint(message: string, component?: string): string {
  const key = `${message.slice(0, 200)}|${component ?? 'global'}`
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = (h << 5) - h + key.charCodeAt(i)
    h |= 0
  }
  return String(h)
}

function flush() {
  if (queue.length === 0) return
  const toSend = queue.splice(0, BATCH_MAX)
  batchTimer = null
  toSend.forEach(({ error, context }) => sendOne(error, context))
}

function sendOne(error: Error, context: ErrorContext) {
  const fp = fingerprint(error.message, context.component)
  if (recentFingerprints.has(fp)) return
  recentFingerprints.add(fp)
  setTimeout(() => recentFingerprints.delete(fp), DEDUPE_WINDOW_MS)

  const url = context.url ?? (typeof window !== 'undefined' ? window.location.href : '')
  const payload = {
    component: context.component ?? 'global',
    message: error.message,
    stack: error.stack ?? undefined,
    url,
    source: context.source ?? 'global_handler',
    user_agent: context.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
    viewport: context.viewport ?? (typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined),
    route: context.route ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
    user_id: context.userId,
    fingerprint: fp,
    severity: 'error' as const,
  }

  api.post('/api/v2/error-logs', payload).catch(() => {})
}

/**
 * Report an error to the backend. Deduplicated by message+component within 60s.
 * Batched: queued and flushed every 5s or when 10 errors are queued.
 */
export function reportError(error: Error, context: ErrorContext = {}) {
  const ctx: ErrorContext = {
    ...context,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined,
    route: typeof window !== 'undefined' ? window.location.pathname : undefined,
    url: context.url ?? (typeof window !== 'undefined' ? window.location.href : undefined),
  }

  queue.push({ error, context: ctx })
  if (queue.length >= BATCH_MAX) {
    if (batchTimer) clearTimeout(batchTimer)
    batchTimer = null
    flush()
  } else if (!batchTimer) {
    batchTimer = setTimeout(flush, BATCH_INTERVAL_MS)
  }
}
