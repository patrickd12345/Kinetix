import re

with open('apps/web/src/integration/planned-races.integration.test.tsx', 'r') as f:
    content = f.read()

# Make the mocked useAuth return true for profile loading to avoid auth gating issues
mock_replace = """vi.mock('../components/providers/useAuth', () => ({
  useAuth: vi.fn(() => ({
    profile: { id: 'test-profile-123' },
    user: { id: 'test-user-123' },
    signOut: vi.fn(),
  })),
  useRequireAuth: vi.fn(),
}))
"""

content = content.replace("vi.mock('../components/providers/useAuth', () => ({\n  useAuth: vi.fn(),\n}))", mock_replace)


with open('apps/web/src/integration/planned-races.integration.test.tsx', 'w') as f:
    f.write(content)

print("Patched integration test four")
