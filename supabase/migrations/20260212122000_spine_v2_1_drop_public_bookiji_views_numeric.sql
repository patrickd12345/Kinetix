-- SPINE_V2.1 (numeric): drop public compatibility views after qualification checks pass.
-- This migration exists because non-numeric versions (e.g. 20260212A002) are not applied by reset tooling.

BEGIN;
DROP VIEW IF EXISTS public.services;
DROP VIEW IF EXISTS public.provider_locations;
DROP VIEW IF EXISTS public.vendor_specialties;
DROP VIEW IF EXISTS public.recurring_availability_rules;
DROP VIEW IF EXISTS public.availability_slots;
DROP VIEW IF EXISTS public.bookings;
DROP VIEW IF EXISTS public.booking_audit_log;
COMMIT;
