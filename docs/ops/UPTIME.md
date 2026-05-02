## Uptime Monitoring

Monitor the unauthenticated health endpoint:

- URL: `/api/health`
- Method: `GET`
- Vercel function: `api/health/index.ts`
- Expected response:

```json
{
  "status": "ok",
  "service": "kinetix",
  "timestamp": 1714406400000
}
```

### Notes

- Designed for fast checks with no external dependency calls.
- Does not require Supabase Auth, entitlements, Stripe, or provider credentials.
- Suitable for basic uptime probes from:
  - [UptimeRobot](https://uptimerobot.com/)
  - [Better Stack](https://betterstack.com/)
