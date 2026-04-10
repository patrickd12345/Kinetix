import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export type SessionBoundaryPayload = {
  sessionSummary?: string
  current_focus?: string[]
  next_actions?: string[]
  [key: string]: unknown
}

export type SessionHandle = {
  product: string
  tenant: string
  memory: { lastCommitted: SessionBoundaryPayload }
}

export function emptySessionBoundaryPayload(): SessionBoundaryPayload {
  return { sessionSummary: '', current_focus: [], next_actions: [] }
}

export async function startSession(product: string, tenant: string): Promise<SessionHandle> {
  return { product, tenant, memory: { lastCommitted: emptySessionBoundaryPayload() } }
}

export function resolveMemoryFilePath(product: string, tenant: string): string {
  const root = process.env.PERSISTENT_MEMORY_ROOT || '.tmp/persistent-memory'
  return join(root, product, `${tenant}.json`)
}

export async function commitSessionBoundary(handle: SessionHandle, boundary: SessionBoundaryPayload): Promise<void> {
  const filePath = resolveMemoryFilePath(handle.product, handle.tenant)
  await mkdir(dirname(filePath), { recursive: true })
  let existing: Record<string, unknown> = {}
  try {
    existing = JSON.parse(await readFile(filePath, 'utf8'))
  } catch {}
  handle.memory.lastCommitted = boundary
  await writeFile(filePath, JSON.stringify({ ...existing, lastCommitted: boundary }, null, 2), 'utf8')
}
