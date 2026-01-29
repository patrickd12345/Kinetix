# Palette's Journal

## 2024-05-22 - Icon-Only Buttons Accessibility
**Learning:** The application relies heavily on icon-only buttons for primary actions (Start, Stop, Delete) without providing accessible labels. This makes the core functionality unusable for screen reader users.
**Action:** Systematically add `aria-label` to all icon-only buttons during development. Use `title` for tooltip behavior where appropriate, but prioritize `aria-label` for assistive technology.
