## 2025-04-25 - React Component Memoization in Operator Dashboard
**Learning:** Found two functional components (`SummaryCard` and `MetricCard`) in `apps/web/src/pages/OperatorDashboard.tsx` that are rendered inside maps or as multiple instances but are lacking `React.memo()`. This can cause unnecessary re-renders when the parent component state updates (e.g. reload token or metrics changing).
**Action:** Wrap simple functional stateless UI components in `React.memo` to prevent unnecessary re-rendering.
