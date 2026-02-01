## 2025-05-23 - Unstable Hook Returns
**Learning:** Custom hooks like `useAICoach` returning unstable functions (missing `useCallback`) cause cascading re-renders in parent components (`History`), invalidating `React.memo` optimizations in children (`RunListItem`).
**Action:** Always verify custom hooks wrap returned functions in `useCallback` before optimizing consumers.
