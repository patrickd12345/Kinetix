## 2024-05-22 - [Hooks Missing Memoization]
**Learning:** Custom hooks (like `useAICoach`) returning non-memoized functions cause downstream `React.memo` components to re-render unnecessarily, negating optimization efforts.
**Action:** Always wrap functions returned from custom hooks in `useCallback` to ensure referential stability.
