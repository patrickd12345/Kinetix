-- Marketplace Guard Violations
-- Stores blocked attempts to access marketplace-capable endpoints from external context.
-- Jarvis reads this for CRITICAL invariant violations (provider-scoped scheduling safety).

BEGIN;
CREATE TABLE IF NOT EXISTS marketplace_guard_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  method text NOT NULL,
  origin text,
  referer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketplace_guard_violations_created
  ON marketplace_guard_violations(created_at DESC);
ALTER TABLE marketplace_guard_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only"
  ON marketplace_guard_violations
  FOR ALL
  USING (false)
  WITH CHECK (false);
GRANT ALL ON marketplace_guard_violations TO service_role;
COMMIT;
