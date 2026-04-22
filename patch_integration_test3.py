import re

with open('apps/web/src/integration/planned-races.integration.test.tsx', 'r') as f:
    content = f.read()

mock_replace = """vi.mock('../lib/database', () => ({
  getDb: vi.fn(() => ({
    weightHistory: { count: vi.fn().mockResolvedValue(0) },
    runs: { toArray: vi.fn().mockResolvedValue([]) },
  })),
  getWeightHistoryCount: vi.fn().mockResolvedValue(0),
  getWeightsForDates: vi.fn().mockResolvedValue([]),
}))
"""

# Replace the incorrect mock setup
content = content.replace("import { setActiveDbForTesting } from '../lib/database'\nimport Dexie from 'dexie'\n\nconst mockDb = new Dexie('TestDb') as any;\nmockDb.version(1).stores({ runs: '++id' })", mock_replace)
content = content.replace("    setActiveDbForTesting(mockDb)\n", "")

with open('apps/web/src/integration/planned-races.integration.test.tsx', 'w') as f:
    f.write(content)

print("Patched integration test three")
