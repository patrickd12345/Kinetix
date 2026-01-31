# BOLT'S JOURNAL - CRITICAL LEARNINGS ONLY

## 2025-05-23 - [Frontend Performance Patterns]
**Learning:** In a Zustand + React app, extracting list items to memoized components (`React.memo`) is critical when the parent component manages global UI state (like modals) that triggers frequent re-renders. Without this, simple interactions like opening a modal can cause the entire list (potentially hundreds of items) to re-render unnecessarily.
**Action:** Always prefer extracting list items to separate, memoized components, especially in pages that also handle "view" state like modals or filters.
