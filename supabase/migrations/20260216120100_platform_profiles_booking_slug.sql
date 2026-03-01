-- Human-friendly booking link slug for vendors (e.g. /v/marie-plumber/book-now).
-- Unique so one slug maps to one vendor; nullable for existing profiles.
ALTER TABLE platform.profiles
  ADD COLUMN IF NOT EXISTS booking_slug text UNIQUE;
COMMENT ON COLUMN platform.profiles.booking_slug IS 'Vendor slug for /v/[slug]/book-now; lowercase alphanumeric and hyphens.';
-- Referral code for customer referral link (optional; can be derived from id if null).
ALTER TABLE platform.profiles
  ADD COLUMN IF NOT EXISTS referral_code text;
COMMENT ON COLUMN platform.profiles.referral_code IS 'Customer referral code for ?ref= in links; used for referral milestones.';
