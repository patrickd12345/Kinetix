begin;

update platform.entitlements
set
  active = true,
  starts_at = coalesce(starts_at, now()),
  ends_at = null,
  source = 'manual',
  metadata = coalesce(metadata, '{}'::jsonb) || '{"seeded_by":"20260228221147","reason":"kinetix entitlement gating fix"}'::jsonb,
  updated_at = now()
where user_id = '2d6e3cef-dd9f-4662-838e-0d655d5e0e3c'
  and product_key = 'kinetix';

insert into platform.entitlements (
  user_id,
  product_key,
  entitlement_key,
  active,
  source,
  metadata,
  starts_at,
  ends_at
)
select
  '2d6e3cef-dd9f-4662-838e-0d655d5e0e3c',
  'kinetix',
  'default',
  true,
  'manual',
  '{"seeded_by":"20260228221147","reason":"kinetix entitlement gating fix"}'::jsonb,
  now(),
  null
where not exists (
  select 1
  from platform.entitlements
  where user_id = '2d6e3cef-dd9f-4662-838e-0d655d5e0e3c'
    and product_key = 'kinetix'
);

commit;
