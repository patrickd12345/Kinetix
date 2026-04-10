# Kinetix Scope Closure Rules

All feature work must follow this lifecycle:

1. Open Build
2. Soft Freeze
3. Closed
4. Integration Testing
5. Verified

Rules:

- No new features allowed in Closed areas
- No schema changes allowed in Soft Freeze unless critical
- Integration testing only allowed on Closed areas
- Status changes must update KINETIX_SCOPE_CLOSURE.md
- PRs touching a feature must update its status when applicable

This document is mandatory for all Kinetix development.
