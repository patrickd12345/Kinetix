-- Create provider_schedules table
CREATE TABLE IF NOT EXISTS provider_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT no_overlapping_schedule CHECK (start_time < end_time),
    UNIQUE(profile_id, day_of_week, start_time, end_time)
);
CREATE INDEX IF NOT EXISTS idx_provider_schedules_profile_day ON provider_schedules(profile_id, day_of_week);
-- Enable RLS
ALTER TABLE provider_schedules ENABLE ROW LEVEL SECURITY;
-- Drop existing policies if any
DROP POLICY IF EXISTS "Providers can manage own schedules" ON provider_schedules;
DROP POLICY IF EXISTS "Providers with active subscription can manage own schedules" ON provider_schedules;
-- Create new policy with subscription check for provider_schedules
DO $$
DECLARE
    v_vendor_col TEXT;
    v_status_col TEXT;
    v_status_filter TEXT;
BEGIN
    SELECT column_name INTO v_vendor_col
    FROM information_schema.columns
    WHERE table_name = 'vendor_subscriptions'
      AND column_name IN ('provider_id', 'vendor_id')
    ORDER BY CASE column_name WHEN 'provider_id' THEN 1 ELSE 2 END
    LIMIT 1;

    IF v_vendor_col IS NULL THEN
        RAISE EXCEPTION 'vendor_subscriptions is missing provider_id/vendor_id column';
    END IF;

    SELECT column_name INTO v_status_col
    FROM information_schema.columns
    WHERE table_name = 'vendor_subscriptions'
      AND column_name IN ('subscription_status', 'status')
    ORDER BY CASE column_name WHEN 'subscription_status' THEN 1 ELSE 2 END
    LIMIT 1;

    v_status_filter := CASE
        WHEN v_status_col IS NULL THEN 'TRUE'
        ELSE format('vs.%I IN (''active'', ''trialing'')', v_status_col)
    END;

    EXECUTE format($policy$
        CREATE POLICY "Providers with active subscription can manage own schedules" ON provider_schedules
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles p
                JOIN vendor_subscriptions vs ON vs.%I = p.id
                WHERE p.id = provider_schedules.profile_id
                  AND p.auth_user_id = auth.uid()
                  AND %s
            )
        )
    $policy$, v_vendor_col, v_status_filter);
END $$;
-- Update RLS policies for availability_slots
DROP POLICY IF EXISTS "Providers can manage own availability" ON availability_slots;
DROP POLICY IF EXISTS "Providers with active subscription can manage own availability" ON availability_slots;
DO $$
DECLARE
    v_vendor_col TEXT;
    v_status_col TEXT;
    v_status_filter TEXT;
BEGIN
    SELECT column_name INTO v_vendor_col
    FROM information_schema.columns
    WHERE table_name = 'vendor_subscriptions'
      AND column_name IN ('provider_id', 'vendor_id')
    ORDER BY CASE column_name WHEN 'provider_id' THEN 1 ELSE 2 END
    LIMIT 1;

    IF v_vendor_col IS NULL THEN
        RAISE EXCEPTION 'vendor_subscriptions is missing provider_id/vendor_id column';
    END IF;

    SELECT column_name INTO v_status_col
    FROM information_schema.columns
    WHERE table_name = 'vendor_subscriptions'
      AND column_name IN ('subscription_status', 'status')
    ORDER BY CASE column_name WHEN 'subscription_status' THEN 1 ELSE 2 END
    LIMIT 1;

    v_status_filter := CASE
        WHEN v_status_col IS NULL THEN 'TRUE'
        ELSE format('vs.%I IN (''active'', ''trialing'')', v_status_col)
    END;

    EXECUTE format($policy$
        CREATE POLICY "Providers with active subscription can manage own availability" ON availability_slots
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM profiles p
                JOIN vendor_subscriptions vs ON vs.%I = p.id
                WHERE p.id = availability_slots.provider_id
                  AND p.auth_user_id = auth.uid()
                  AND %s
            )
        )
    $policy$, v_vendor_col, v_status_filter);
END $$;
