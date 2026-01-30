## 2025-02-18 - Custom Toggle Accessibility
**Learning:** Custom toggle buttons using `<div>` styled inside a `<button>` provide no semantic info to screen readers. Adding `role="switch"` and `aria-checked` immediately fixes this without changing visual design.
**Action:** When auditing settings pages, prioritize checking custom switches for accessibility attributes and focus rings.
