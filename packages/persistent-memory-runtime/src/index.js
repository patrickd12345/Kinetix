import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export function emptySessionBoundaryPayload() {
  return { sessionSummary: '', current_focus: [], next_actions: [] }
}

export async function startSession(product, tenant) {
  return { product, tenant, memory: { lastCommitted: emptySessionBoundaryPayload() } }
}

export function resolveMemoryFilePath(product, tenant) {
  const root = process.env.PERSISTENT_MEMORY_ROOT || '.tmp/persistent-memory'
  return join(root, product, `${tenant}.json`)
}

export async function commitSessionBoundary(handle, boundary) {
  const filePath = resolveMemoryFilePath(handle.product, handle.tenant)
  await mkdir(dirname(filePath), { recursive: true })
  let existing = {}
  try {
    existing = JSON.parse(await readFile(filePath, 'utf8'))
  } catch {}
  handle.memory.lastCommitted = boundary
  await writeFile(filePath, JSON.stringify({ ...existing, lastCommitted: boundary }, null, 2), 'utf8')
}
