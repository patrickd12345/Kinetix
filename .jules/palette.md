## 2024-05-22 - Missing Form Label Associations
**Learning:** Found a pattern of inputs in `Settings.tsx` using unlinked `<label>` and `<input>` tags. This fails WCAG 3.3.2 and hinders click-to-focus behavior.
**Action:** Always verify form inputs have explicit `htmlFor`/`id` bindings or are wrapped in the label.
