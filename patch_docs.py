import re

with open('docs/PROJECT_PLAN.md', 'r') as f:
    content = f.read()

backlog_section = """## Next up (Phase 5+)

- Native Apple Watch App: Heart rate, real-time pace, live KPS display.
- Offline support: Sync strategies for no-signal scenarios."""

new_backlog = """## Next up (Phase 5+)

- **KX-FEAT-005 (Planned Races):** Added persistent storage, Settings UI, and deterministic phase-aware coaching logic for upcoming races.
- Native Apple Watch App: Heart rate, real-time pace, live KPS display.
- Offline support: Sync strategies for no-signal scenarios."""

if backlog_section in content:
    content = content.replace(backlog_section, new_backlog)
else:
    # If the backlog section doesn't match exactly, just append the feature to the end of the doc
    content += "\n\n## Completed Features\n- **KX-FEAT-005 (Planned Races):** Added persistent storage, Settings UI, and deterministic phase-aware coaching logic for upcoming races.\n"

with open('docs/PROJECT_PLAN.md', 'w') as f:
    f.write(content)

print("Updated PROJECT_PLAN.md")
