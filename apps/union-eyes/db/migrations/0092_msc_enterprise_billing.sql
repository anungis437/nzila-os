-- Migration 0092: Set MSC org to enterprise tier and upgrade member plans
-- Aligns billing data so org members receive enterprise-level features.

-- 1. Set MSC organization to enterprise subscription tier
UPDATE organizations
SET subscription_tier = 'enterprise'
WHERE id = '44444444-4444-4444-4444-444444444444'
  AND (subscription_tier IS NULL OR subscription_tier != 'enterprise');

-- 2. Upgrade MSC listener profiles to premium (org-entitled)
UPDATE zonga_listeners
SET plan = 'premium', subscription_status = 'active'
WHERE user_id IN ('user_msc_admin_01', 'user_msc_listener_01', 'user_msc_listener_02')
  AND (plan != 'premium' OR subscription_status != 'active');

-- 3. Set MSC creators to enterprise plan
UPDATE zonga_creators
SET plan = 'enterprise', subscription_status = 'active'
WHERE org_id = '44444444-4444-4444-4444-444444444444'
  AND (plan != 'enterprise' OR subscription_status != 'active');
