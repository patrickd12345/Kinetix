## 2026-02-06 - AI Coach Hook Re-renders
**Learning:** The `useAICoach` hook manages global UI state (analysis modal) but returned unstable function references (`analyzeRun`). When used in list views like `History`, this caused the entire list to re-render whenever the AI state changed, defeating optimization attempts.
**Action:** Always wrap functions returned from hooks in `useCallback` if they are likely to be passed to memoized components, especially in this app where hooks drive global UI overlays.
