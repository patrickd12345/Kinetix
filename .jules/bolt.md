## 2025-03-02 - Dexie array initialization optimization
**Learning:** Dexie queries shouldn't fetch all objects via `.toArray()` and then `.filter()` in standard JS. In large histories, this incurs O(n) array materialization overhead, causing UI stutters. Dexie supports applying predicates natively via `.filter()` *before* `.toArray()`, minimizing allocations.
**Action:** Use `await db.table.filter(...).toArray()` instead of `(await db.table.toArray()).filter(...)`.
