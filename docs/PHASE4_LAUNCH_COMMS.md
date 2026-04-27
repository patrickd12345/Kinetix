# Phase 4 launch comms (Lane D)

Templates for the day-of and week-of public launch announcement.

## Pre-flight gate

Do **not** publish any of the below until:

1. All "Operator action queue" rows in [`PHASE4_RELEASE_EVIDENCE.md`](PHASE4_RELEASE_EVIDENCE.md) are PASS.
2. Lane B (iOS + watchOS) has been **approved** in App Store Connect (not just submitted). If Lane B is delayed, launch web only and remove Watch/iPhone language from the comms.
3. Status page is live at `status.bookiji.com`.
4. Privacy + Terms are published at the URLs in [`PRIVACY_TOS_LAUNCH_REVIEW.md`](PRIVACY_TOS_LAUNCH_REVIEW.md).
5. Garmin language: keep generic (e.g. "Garmin sync coming after partner approval"); do not promise dates.

## In-app banner (Kinetix web)

```
We're live. Welcome to Kinetix - your AI running coach.
> Set up your first weekly plan in under 60 seconds.
```

Add as a dismissible banner to the dashboard for 7 days post-launch.

## Email (existing beta list)

Subject: `Kinetix is live - your coach is ready`

```
Hi {first_name},

Today we opened Kinetix to the public. As a beta tester, you already have access - thank you for the runs you logged and the bugs you flagged.

What's new since beta:
- Live subscription billing (manage from Settings)
- iOS + Apple Watch apps in the App Store: <link>
- Weekly AI coaching plan that adapts to your KPS
- Improved sync reliability (Strava, Withings, file-based Garmin)

Garmin Connect partner sync is in review with Garmin and will land in a future update.

Open Kinetix: https://kinetix.bookiji.com

Status page: https://status.bookiji.com
Help Center: https://kinetix.bookiji.com/help

Thanks for running with us,
The Kinetix team
```

## Social - X / Threads

```
Kinetix is live.

AI running coach. Weekly plans that adapt to your readiness. iOS + Apple Watch from day one.

Free trial; subscribe from inside the app.

Try it: https://kinetix.bookiji.com
```

## Social - LinkedIn (Bookiji corporate)

```
We're launching Kinetix today - the running coach product from Bookiji Inc.

Built on the Bookiji platform: shared identity, shared billing, shared observability. Three surfaces (web, iPhone, Apple Watch) shipped on day one.

A few things we're proud of:
- KPS (Kinetix Performance Score) as the runner-facing summary metric
- A coach that learns from your sleep + HRV + run data
- Reader-app posture on iOS (no IAP), Stripe billing on web

Try Kinetix: https://kinetix.bookiji.com
Privacy: <privacy URL>
Status: https://status.bookiji.com
```

## Press one-pager (optional)

Section headers:
1. What it is.
2. Why now.
3. Founders / team.
4. Product surfaces.
5. Privacy posture (no resale of fitness data, sub-processor list, Apple HealthKit on-device).
6. Roadmap (Garmin partner sync, plan personalization).
7. Contact.

Fill in copy from [`PRIVACY_TOS_LAUNCH_REVIEW.md`](PRIVACY_TOS_LAUNCH_REVIEW.md) data inventory and keep claims provable.

## Kill switch

If a SEV-1 happens within 24h of launch comms going out:

1. Pin status page incident to top of social.
2. Send a short follow-up email acknowledging the issue and the fix ETA.
3. Pause paid acquisition / link sharing until status page is back to "Operational".
