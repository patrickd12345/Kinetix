import re

with open('apps/web/src/integration/planned-races.integration.test.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { renderWithProviders } from '../test/renderWithProviders'", "import { render } from '@testing-library/react'\nimport { MemoryRouter } from 'react-router-dom'")
content = content.replace("renderWithProviders(<Settings />)", "render(<MemoryRouter><Settings /></MemoryRouter>)")

with open('apps/web/src/integration/planned-races.integration.test.tsx', 'w') as f:
    f.write(content)

print("Patched integration test")
