## 2026-02-05 - [React List Rendering]
**Learning:** The `History` page re-renders the entire list of runs when interacting with the AI Coach modal (global state change in parent) because list items were not memoized and handlers were unstable.
**Action:** Always memoize list items in `apps/web` components that share state with modals or other frequent updaters.
