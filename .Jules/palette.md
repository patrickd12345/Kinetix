## 2024-05-22 - Accessibility Patterns & Missing Configs
**Learning:** `apps/web` uses a custom button-based toggle switch pattern that requires manual `role="switch"` and `aria-checked` attributes. Also discovered that `apps/web` lacks an ESLint configuration file, causing `pnpm lint` to fail or skip files.
**Action:** Always verify `role="switch"` on custom toggles. Ideally, fix the ESLint config in a future "chore" task to enable proper linting.
