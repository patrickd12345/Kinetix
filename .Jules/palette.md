## 2024-05-22 - Icon-Only Buttons Accessibility
**Learning:** Icon-only buttons (Play, Pause, Stop, etc.) consistently lacked `aria-label` across the application, making them unusable for screen readers.
**Action:** When adding new icon buttons, always include `aria-label` attribute describing the action.
