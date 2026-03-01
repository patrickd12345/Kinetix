-- CU-P1C: Provider Availability (Manual, Non-Recurring)
-- Manual availability: day + start/end times, timezone-safe

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE provider_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT provider_availability_start_before_end CHECK (start_time < end_time)
);
-- Exclusion: same auth_user_id + day_of_week cannot have overlapping time ranges
-- period = tsrange on a fixed date (2000-01-01 + day) + start/end time
ALTER TABLE provider_availability
  ADD COLUMN _period tsrange GENERATED ALWAYS AS (
    tsrange(
      ('2000-01-01'::date + day_of_week * interval '1 day') + start_time,
      ('2000-01-01'::date + day_of_week * interval '1 day') + end_time
    )
  ) STORED;
ALTER TABLE provider_availability
  ADD CONSTRAINT provider_availability_no_overlap
  EXCLUDE USING gist (auth_user_id WITH =, day_of_week WITH =, _period WITH &&);
CREATE INDEX idx_provider_availability_auth_user ON provider_availability (auth_user_id);
ALTER TABLE provider_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select own provider_availability" ON provider_availability
  FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "Users can insert own provider_availability" ON provider_availability
  FOR INSERT WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "Users can update own provider_availability" ON provider_availability
  FOR UPDATE USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "Users can delete own provider_availability" ON provider_availability
  FOR DELETE USING (auth.uid() = auth_user_id);
CREATE POLICY "Service role can manage provider_availability" ON provider_availability
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
