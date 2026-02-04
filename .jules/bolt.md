## 2024-05-23 - Custom Hook Stability
**Learning:** Custom hooks like `useAICoach` often return inline functions. This breaks `React.memo` optimization in consuming components because the function references change on every render.
**Action:** Always wrap functions returned from custom hooks in `useCallback` if those hooks are intended to be used in performance-sensitive lists or memoized components.
