# Adding kinetix.bookiji.com Subdomain to Vercel

This document covers wiring the Kinetix web app to the subdomain `kinetix.bookiji.com` for SSO with the main Bookiji domain.

## Prerequisites

- Vercel CLI installed and authenticated with the same account used for Bookiji.
- Access to the DNS provider for `bookiji.com` (e.g. GoDaddy, Cloudflare).

## 1. Add domain in Vercel (Kinetix project)

From the **Kinetix** repo root (where `vercel.json` lives):

```bash
# 1. Link the Kinetix project (if not already linked)
vercel link --yes

# 2. Add the subdomain
vercel domains add kinetix.bookiji.com

# 3. Verify it was added
vercel domains ls
```

## 2. DNS configuration at registrar

After adding the domain in Vercel:

1. **Get the DNS target from Vercel:**
   ```bash
   vercel domains inspect kinetix.bookiji.com
   ```

2. **Create CNAME record at your DNS provider:**
   - **Type:** `CNAME`
   - **Host / Name:** `kinetix`
   - **Points to / Value:** Use the target Vercel shows (e.g. `cname.vercel-dns.com` or project-specific)
   - **TTL:** `3600` or default

Save the record and wait for propagation (typically 5–15 minutes).

## 3. Verify domain and SSL

```bash
# Check domain status in Vercel
vercel domains inspect kinetix.bookiji.com

# Test the subdomain (after propagation)
curl -I https://kinetix.bookiji.com
```

Ensure the response is `200` (or the app’s expected status) and that the certificate is valid.

## 4. Next steps

- Configure **Supabase Auth**: Site URL `https://bookiji.com`, add redirect URLs for `https://kinetix.bookiji.com` and `https://kinetix.bookiji.com/**`. See `bookiji/docs/deployment/SUPABASE_AUTH_SUBDOMAINS.md`.
- Set **Kinetix deployment env vars** to match Bookiji Supabase (see Kinetix env parity docs).
- Run the **manual verification checklist** (login on bookiji.com, open kinetix.bookiji.com, confirm no login screen and entitlement gating).

## Notes

- Vercel provisions SSL for the subdomain automatically.
- Kinetix is a separate Vercel project from Bookiji; this subdomain points to the Kinetix deployment only.
