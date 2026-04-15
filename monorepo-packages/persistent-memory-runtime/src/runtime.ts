import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/** Bookiji Inc products that participate in persistent memory boundaries. */
export type ProductId = 'bookiji' | 'myassist' | 'kinetix' | 'chess'

/** Deterministic payload written at session boundaries (disk-backed, no DB). */
export type SessionBoundaryPayload = {
  sessionSummary: string
  decisionsMade: string[]
  newlyActiveWork: string[]
  completedWork: string[]
  current_focus: string[]
  blockers: string[]
  in_progress: string[]
  next_actions: string[]
}

export function emptySessionBoundaryPayload(sessionSummary = ''): SessionBoundaryPayload {
  return {
    sessionSummary,
    decisionsMade: [],
    newlyActiveWork: [],
    completedWork: [],
    current_focus: [],
    blockers: [],
    in_progress: [],
    next_actions: [],
  }
}

export type PersistentMemoryState = {
  /** Last successfully committed boundary snapshot. */
  lastCommitted: SessionBoundaryPayload | null
  /** Recent boundaries (newest last), capped. */
  history: SessionBoundaryPayload[]
}

const HISTORY_CAP = 48

function defaultState(): PersistentMemoryState {
  return { lastCommitted: null, history: [] }
}

function sanitizeTenantKey(tenantKey: string): string {
  const t = tenantKey.trim()
  if (!t) return '_anonymous'
  return t.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200)
}

export function resolvePersistentMemoryRoot(): string {
  const fromEnv = process.env.PERSISTENT_MEMORY_ROOT?.trim()
  if (fromEnv) {
    return fromEnv
  }
  return join(tmpdir(), 'bookiji-persistent-memory')
}

export function resolveMemoryFilePath(product: ProductId, tenantKey: string): string {
  const safe = sanitizeTenantKey(tenantKey)
  return join(resolvePersistentMemoryRoot(), product, safe, 'memory.json')
}

async function loadState(path: string): Promise<PersistentMemoryState> {
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return defaultState()
    const o = parsed as Partial<PersistentMemoryState>
    const history = Array.isArray(o.history) ? o.history.filter(isBoundaryPayload) : []
    const lastCommitted =
      o.lastCommitted && isBoundaryPayload(o.lastCommitted) ? o.lastCommitted : null
    return { lastCommitted, history }
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') return defaultState()
    throw e
  }
}

function isBoundaryPayload(v: unknown): v is SessionBoundaryPayload {
  if (!v || typeof v !== 'object') return false
  const x = v as Record<string, unknown>
  return (
    typeof x.sessionSummary === 'string' &&
    Array.isArray(x.decisionsMade) &&
    Array.isArray(x.newlyActiveWork) &&
    Array.isArray(x.completedWork) &&
    Array.isArray(x.current_focus) &&
    Array.isArray(x.blockers) &&
    Array.isArray(x.in_progress) &&
    Array.isArray(x.next_actions)
  )
}

export type PersistentSessionHandle = {
  readonly product: ProductId
  readonly tenantKey: string
  readonly memoryFilePath: string
  /** In-memory view; safe to mutate for the current request. */
  memory: PersistentMemoryState
}

/**
 * Load persistent memory from disk (or empty state). Call once per logical AI session / request scope.
 */
export async function startSession(product: ProductId, tenantKey: string): Promise<PersistentSessionHandle> {
  const safeTenant = sanitizeTenantKey(tenantKey)
  const memoryFilePath = resolveMemoryFilePath(product, safeTenant)
  const memory = await loadState(memoryFilePath)
  return {
    product,
    tenantKey: safeTenant,
    memoryFilePath,
    memory,
  }
}

/**
 * Append a deterministic boundary snapshot and persist to disk (JSON file, no DB).
 */
export async function commitSessionBoundary(
  handle: PersistentSessionHandle,
  payload: SessionBoundaryPayload,
): Promise<void> {
  const next: PersistentMemoryState = {
    lastCommitted: payload,
    history: [...handle.memory.history, payload].slice(-HISTORY_CAP),
  }
  handle.memory = next
  await mkdir(join(handle.memoryFilePath, '..'), { recursive: true })
  await writeFile(handle.memoryFilePath, JSON.stringify(next, null, 2), 'utf8')
}

/**
 * Convenience: load session context then run work. Does not commit; use `commitSessionBoundary` when the unit of work completes.
 */
export async function runSession<T>(
  product: ProductId,
  tenantKey: string,
  fn: (ctx: PersistentSessionHandle) => Promise<T>,
): Promise<T> {
  const ctx = await startSession(product, tenantKey)
  return fn(ctx)
}
