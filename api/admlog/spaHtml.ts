import type { AuthSession } from '@supabase/supabase-js'
import type { ServerResponse } from 'http'
import type { VercelResponse } from '@vercel/node'

/**
 * Browser localStorage key used by @supabase/supabase-js (must match apps/web supabaseClient).
 * Project ref is the first label of the project host (e.g. `abcdefgh` from `abcdefgh.supabase.co`).
 */
export function getSupabaseBrowserAuthStorageKey(supabaseUrl: string): string {
  const hostname = new URL(supabaseUrl).hostname
  const projectRef = hostname.split('.')[0] ?? 'supabase'
  return `sb-${projectRef}-auth-token`
}

/**
 * Minimal HTML page that persists the Supabase session into localStorage and navigates client-side.
 * Required for Vite SPA: cookie-only sessions from SSR helpers are not read by createClient in the browser.
 */
export function buildAdmlogSpaSessionHtml(options: {
  session: AuthSession
  supabaseUrl: string
  redirectPath: string
}): string {
  const storageKey = getSupabaseBrowserAuthStorageKey(options.supabaseUrl)
  const sessionJson = JSON.stringify(options.session)
  const redirect = JSON.stringify(options.redirectPath.startsWith('/') ? options.redirectPath : `/${options.redirectPath}`)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dev sign-in</title>
</head>
<body>
  <p>Completing dev sign-in…</p>
  <script type="application/json" id="admlog-session">${sessionJson.replace(/</g, '\\u003c')}</script>
  <script>
    (function () {
      var key = ${JSON.stringify(storageKey)};
      var el = document.getElementById('admlog-session');
      var session = JSON.parse(el.textContent || '{}');
      try {
        localStorage.setItem(key, JSON.stringify(session));
      } catch (e) {
        document.body.textContent = 'Could not write session to storage. Check third-party cookie / storage settings.';
        console.error(e);
        return;
      }
      var target = ${redirect};
      window.location.replace(target);
    })();
  </script>
</body>
</html>`
}

/** Works with Vercel serverless `VercelResponse` and the Node shim used by Vite dev. */
export function sendAdmlogHtmlResponse(res: VercelResponse, html: string): void {
  const r = res as unknown as ServerResponse
  r.statusCode = 200
  r.setHeader('Content-Type', 'text/html; charset=utf-8')
  r.end(html)
}
