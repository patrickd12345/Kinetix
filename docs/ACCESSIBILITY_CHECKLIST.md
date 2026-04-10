# Kinetix Accessibility Checklist

Manual verification for `products/Kinetix/apps/web` before release or after shell/help UI changes.

## Shell navigation

- Desktop/tablet: sidebar is visible and is the only primary app navigation.
- Top bar contains only brand, account area, theme toggle, and sign out.
- Mobile: bottom nav shows `Run`, `History`, `Coaching`, `Chat`, `Help`, and `More`.
- Mobile overflow (`More`) exposes `Weight`, `Charts`, `Settings`, `Operator`, and `Queue`.
- Active navigation state is obvious in sidebar, bottom nav, and overflow routes.

## Light mode

- Body text is readable on all shell and Help Center surfaces.
- Helper and tertiary text remain subordinate without looking washed out.
- Placeholder text is readable in form fields.
- Disabled controls remain legible and visibly disabled.
- Readonly and loading states remain distinguishable from editable/idle states.

## Dark mode

- Shell and Help Center text maintains readable contrast.
- Active states remain obvious without relying on color alone.
- Disabled, readonly, loading, success, warning, and error states remain distinct.
- Focus indicators remain visible against dark surfaces.

## Keyboard

- Tab order is usable across shell, Help Center, and mobile overflow navigation.
- Focus ring is visible on links, buttons, inputs, nav items, and dialog actions.
- No interactive shell/help control suppresses keyboard focus without a replacement ring.
- Dialog focus stays trapped while open and returns cleanly on close.
- No keyboard traps occur in shell navigation or Help Center flows.

## Responsive

- Desktop/tablet shell keeps sidebar navigation and no duplicated header nav.
- Mobile bottom nav remains reachable without clipped labels or controls.
- Mobile `More` sheet is usable with touch and keyboard.
- No shell/help content is clipped or obscured by sticky header or bottom nav.

## Zoom

- Verify layout and readability at 100% zoom.
- Verify layout and readability at 125% zoom.
- Verify layout and readability at 150% zoom.

## State distinguishability

- Disabled controls are readable and not opacity-only.
- Loading controls remain identifiable while busy.
- Readonly fields remain visually distinct from editable fields.
- Selected and active nav/items remain visually obvious in both themes.
