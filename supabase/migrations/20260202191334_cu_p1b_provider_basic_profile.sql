-- CU-P1B: Provider Basic Profile - extend profiles table and tighten RLS
-- Storage: business_name, contact_email, city_or_region (phone already exists)
-- RLS: owner-only read/insert/update; remove broad public read

-- A) Add columns (phone already exists in profiles)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS city_or_region TEXT;
-- B) CHECK constraint: vendor role requires non-empty business_name, contact_email, phone, city_or_region
-- NOT VALID skips validation of existing rows; new/updated rows must satisfy
ALTER TABLE profiles
  ADD CONSTRAINT profiles_vendor_required_fields
  CHECK (
    role != 'vendor'
    OR (
      business_name IS NOT NULL AND trim(business_name) != ''
      AND contact_email IS NOT NULL AND trim(contact_email) != ''
      AND phone IS NOT NULL AND trim(phone) != ''
      AND city_or_region IS NOT NULL AND trim(city_or_region) != ''
    )
  ) NOT VALID;
-- C) Fix profiles RLS
-- Drop broad public read policy
DROP POLICY IF EXISTS "Anyone can view public profile info" ON profiles;
-- Add INSERT policy for own profile (Users can view/update already exist)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id);
-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
