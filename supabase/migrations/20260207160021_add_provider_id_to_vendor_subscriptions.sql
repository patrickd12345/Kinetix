-- Add provider_id to vendor_subscriptions for app compatibility
-- The app (SubscriptionManager, /api/vendor/subscription/status) queries by provider_id (profile.id).
-- vendor_id = auth.uid(); provider_id = profiles.id where profiles.auth_user_id = vendor_id.

ALTER TABLE vendor_subscriptions
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
-- Backfill: set provider_id from profiles where auth_user_id = vendor_id
UPDATE vendor_subscriptions vs
SET provider_id = p.id
FROM profiles p
WHERE p.auth_user_id = vs.vendor_id AND vs.provider_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_subscriptions_provider_id
  ON vendor_subscriptions(provider_id);
