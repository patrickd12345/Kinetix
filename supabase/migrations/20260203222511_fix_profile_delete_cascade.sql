-- Fix user deletion: several tables had REFERENCES profiles(id) with default ON DELETE NO ACTION,
-- which blocks profile cascade when auth.users is deleted. Change to CASCADE or SET NULL.

-- admin_audit_log: CASCADE (delete audit entries when admin is deleted)
ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_admin_user_id_fkey;
ALTER TABLE admin_audit_log
  ADD CONSTRAINT admin_audit_log_admin_user_id_fkey
  FOREIGN KEY (admin_user_id) REFERENCES profiles(id) ON DELETE CASCADE;
-- analytics_events: CASCADE (delete user's analytics)
ALTER TABLE analytics_events DROP CONSTRAINT IF EXISTS analytics_events_user_id_fkey;
ALTER TABLE analytics_events
  ADD CONSTRAINT analytics_events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
-- analytics_sessions: CASCADE
ALTER TABLE analytics_sessions DROP CONSTRAINT IF EXISTS analytics_sessions_user_id_fkey;
ALTER TABLE analytics_sessions
  ADD CONSTRAINT analytics_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
-- performance_metrics: CASCADE
ALTER TABLE performance_metrics DROP CONSTRAINT IF EXISTS performance_metrics_user_id_fkey;
ALTER TABLE performance_metrics
  ADD CONSTRAINT performance_metrics_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
-- rag_entries.approved_by: SET NULL (keep entry, clear approver)
ALTER TABLE rag_entries DROP CONSTRAINT IF EXISTS rag_entries_approved_by_fkey;
ALTER TABLE rag_entries
  ADD CONSTRAINT rag_entries_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
-- reviews.moderated_by: SET NULL
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_moderated_by_fkey;
ALTER TABLE reviews
  ADD CONSTRAINT reviews_moderated_by_fkey
  FOREIGN KEY (moderated_by) REFERENCES profiles(id) ON DELETE SET NULL;
-- support_tickets.assigned_to: SET NULL
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_assigned_to_fkey;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;
