# Palette's Journal - Critical UX/Accessibility Learnings

## 2024-05-22 - Accessibility of Custom Toggles
**Learning:** Custom toggle switches implemented as `button` elements must use `role="switch"` and `aria-checked` to be correctly announced by screen readers, rather than just `aria-pressed`.
**Action:** When creating or refactoring custom toggles, always enforce `role="switch"` and `aria-checked` state management.

## 2024-05-22 - Form Label Associations
**Learning:** Inputs without `id`s cannot be programmatically associated with `label` elements using `htmlFor`, which breaks accessibility for screen reader users who rely on label announcements when focusing inputs.
**Action:** Always ensure form inputs have unique `id`s and corresponding `label` elements use `htmlFor`.
