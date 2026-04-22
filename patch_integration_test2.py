import re

with open('apps/web/src/integration/planned-races.integration.test.tsx', 'r') as f:
    content = f.read()

db_mock = """
import { setActiveDbForTesting } from '../lib/database'
import Dexie from 'dexie'

const mockDb = new Dexie('TestDb') as any;
mockDb.version(1).stores({ runs: '++id' })
"""
content = content.replace("import { useAuth } from '../components/providers/useAuth'", db_mock + "\nimport { useAuth } from '../components/providers/useAuth'")

before_each_replace = """  beforeEach(() => {
    setActiveDbForTesting(mockDb)
    vi.clearAllMocks()"""
content = content.replace("  beforeEach(() => {\n    vi.clearAllMocks()", before_each_replace)


with open('apps/web/src/integration/planned-races.integration.test.tsx', 'w') as f:
    f.write(content)

print("Patched integration test again")
