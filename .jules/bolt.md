## 2025-05-23 - [React List Optimization]
**Learning:** In `apps/web`, list items in `History.tsx` were re-rendering unnecessarily when parent state (like `isAnalyzing` from `useAICoach`) updated because callback props were recreated on every render.
**Action:** Extract list items to `React.memo` components (`RunListItem`) and wrap callbacks (`analyzeRun`, `deleteRun`) in `useCallback` to ensure referential stability. This prevents cascading re-renders during state updates.
