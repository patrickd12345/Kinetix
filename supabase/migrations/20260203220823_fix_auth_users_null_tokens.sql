-- Fix "Database error querying schema" during signInWithPassword
-- GoTrue fails when confirmation_token, email_change, email_change_token_new, or recovery_token are NULL
-- (sql: Scan error on column "confirmation_token": converting NULL to string is unsupported)
-- See: https://github.com/supabase/auth/issues/1940

UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  recovery_token = COALESCE(recovery_token, '')
WHERE confirmation_token IS NULL
   OR email_change IS NULL
   OR email_change_token_new IS NULL
   OR recovery_token IS NULL;
