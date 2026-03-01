-- Fix user deletion: system_flags.updated_by had REFERENCES auth.users(id) with default ON DELETE NO ACTION,
-- which blocks auth.users deletion. Change to ON DELETE SET NULL so user delete cascades properly.

ALTER TABLE system_flags
  DROP CONSTRAINT IF EXISTS system_flags_updated_by_fkey;
ALTER TABLE system_flags
  ADD CONSTRAINT system_flags_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
