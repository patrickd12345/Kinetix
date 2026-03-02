SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict kpZwssg1tbbnwnR6UIxmLBcA5AIHKI1HKSW0UfCITU6i9glL1gL09JfwFcP6wKn

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: billing_events; Type: TABLE DATA; Schema: platform; Owner: postgres
--

COPY "platform"."billing_events" ("id", "provider", "event_type", "user_id", "external_event_id", "payload", "processed_at", "created_at") FROM stdin;
\.


--
-- Data for Name: entitlements; Type: TABLE DATA; Schema: platform; Owner: postgres
--

COPY "platform"."entitlements" ("id", "user_id", "product_key", "entitlement_key", "active", "source", "metadata", "starts_at", "ends_at", "created_at", "updated_at") FROM stdin;
6071da39-4d42-491e-88e5-47176b404a3b	2d6e3cef-dd9f-4662-838e-0d655d5e0e3c	kinetix	default	t	manual	{"reason": "kinetix entitlement gating fix", "seeded_by": "20260228221147"}	2026-02-28 22:12:01.69418+00	\N	2026-02-28 22:12:01.69418+00	2026-02-28 22:12:01.69418+00
\.


--
-- Data for Name: feature_flags; Type: TABLE DATA; Schema: platform; Owner: postgres
--

COPY "platform"."feature_flags" ("id", "product_key", "flag_key", "enabled", "description", "rules", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: platform; Owner: postgres
--

COPY "platform"."profiles" ("id", "email", "role", "full_name", "created_at", "updated_at", "phone", "avatar_url", "business_name", "contact_email", "city_or_region", "specializations", "service_area_radius", "verified_at", "availability_mode", "business_hours", "timezone", "preferences", "beta_status", "org_id", "username", "service_type", "service_area", "booking_slug", "referral_code") FROM stdin;
eaecef75-a8da-40ab-8147-b3493b3381b2	admin@bookiji.com	admin	Admin User	2025-12-23 12:05:24.287+00	2025-12-23 12:05:24.288+00	\N	\N	\N	\N	\N	{}	10	\N	subtractive	{}	UTC	{}	\N	\N	\N	\N	\N	\N	\N
e2e00000-0000-0000-0000-000000000001	e2e-vendor@bookiji.test	vendor	E2E Test Vendor	2025-12-25 16:06:27.378203+00	2025-12-25 16:06:27.378203+00	+15551234567	\N	E2E Test Business	e2e-vendor@bookiji.test	E2E Test City	{}	10	\N	subtractive	{}	UTC	{}	\N	\N	\N	\N	\N	\N	\N
add7ed0b-184f-4b2f-bf41-fe8caf6a3c48	e2e-admin@bookiji.test	admin	E2E Test Admin	2026-02-05 20:31:30.186256+00	2026-02-05 20:31:30.186256+00	\N	\N	\N	\N	\N	{}	10	\N	subtractive	{}	UTC	{}	\N	\N	\N	\N	\N	\N	\N
856729ae-c73e-4ce6-883f-3ce15b397080	pilotmontreal@gmail.com	admin	Patrick Duchesneau	2026-02-08 21:37:00.085+00	2026-02-08 21:37:00.085+00	\N	\N	\N	\N	\N	{}	10	\N	subtractive	{}	UTC	{}	\N	\N	\N	\N	\N	\N	\N
6ea976d2-9927-419b-aa38-c198c6ae81f5	e2e-customer@bookiji.test	customer	E2E Test Customer	2025-12-30 14:18:05.74039+00	2025-12-30 14:18:05.74039+00	\N	\N	\N	\N	\N	{}	10	\N	subtractive	{}	UTC	{}	\N	\N	\N	\N	\N	\N	\N
a6971f90-4e25-42c2-a957-0a3bb8427b1f	vendlog@bookiji.test	vendor	Vendlog Dev Vendor	2026-02-20 20:11:12.561146+00	2026-02-20 21:30:24.082084+00	+15551234567	\N	Dev Vendor Business	vendlog@bookiji.test	Dev City	{}	10	\N	additive	{}	UTC	{}	\N	\N	\N	\N	\N	\N	\N
25eb9996-8eb0-4c57-bbdd-e0053d1f1bf1	admlog@bookiji.test	admin	\N	2026-02-17 12:47:26.524688+00	2026-02-22 18:09:11.230119+00	\N	\N	\N	\N	\N	{}	10	\N	\N	{}	UTC	{}	\N	\N	\N	\N	\N	\N	\N
2d6e3cef-dd9f-4662-838e-0d655d5e0e3c	patrick_duchesneau_1@hotmail.com	customer	\N	2026-02-28 20:19:59.701519+00	2026-02-28 20:19:59.701519+00	\N	\N	\N	\N	\N	{}	10	\N	\N	{}	UTC	{}	\N	\N	\N	\N	\N	\N	\N
743bee0d-3cf9-4d2f-b6f1-e19a4c42d25e	custlog@bookiji.test	customer	\N	2026-02-20 20:10:34.843499+00	2026-02-20 20:46:17.938761+00	\N	\N	\N	\N	\N	{}	10	\N	\N	{}	UTC	{}	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: stripe_customers; Type: TABLE DATA; Schema: platform; Owner: postgres
--

COPY "platform"."stripe_customers" ("id", "user_id", "stripe_customer_id", "provider", "created_at", "updated_at") FROM stdin;
\.


--
-- PostgreSQL database dump complete
--

-- \unrestrict kpZwssg1tbbnwnR6UIxmLBcA5AIHKI1HKSW0UfCITU6i9glL1gL09JfwFcP6wKn

RESET ALL;
