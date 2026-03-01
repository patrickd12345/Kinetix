#!/usr/bin/env node
/**
 * Check Kinetix Vercel project Git link and production branch via REST API.
 * Uses VERCEL_TOKEN if set; otherwise reads token from Vercel CLI auth (after vercel login).
 * Usage: node scripts/vercel-project-git-check.mjs
 */

const projectName = 'kinetix';
const fs = await import('fs');
const path = await import('path');
const os = await import('os');

function getTokenFromCliAuth() {
  const homedir = os.homedir();
  const candidates = [
    path.join(process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming'), 'com.vercel.cli', 'Data', 'auth.json'),
    path.join(homedir, '.config', 'vercel', 'auth.json'),
    path.join(process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local'), 'com.vercel.cli', 'auth.json'),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      const raw = fs.readFileSync(p, 'utf8');
      const data = JSON.parse(raw);
      const token = data.token ?? data.accessToken;
      if (token) return token;
    } catch {
      // skip
    }
  }
  return null;
}

const token = process.env.VERCEL_TOKEN ?? getTokenFromCliAuth();

if (!token) {
  console.error('Missing VERCEL_TOKEN and no Vercel CLI auth found.');
  console.error('Run: vercel login   (then run this script again)');
  console.error('Or:  Create a token at https://vercel.com/account/tokens and set VERCEL_TOKEN');
  process.exit(1);
}

const base = 'https://api.vercel.com';
async function getProject(teamId = null) {
  const url = new URL(`/v9/projects/${projectName}`, base);
  if (teamId) url.searchParams.set('teamId', teamId);
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`API ${r.status}: ${t}`);
  }
  return r.json();
}

(async () => {
  try {
    let project = await getProject();
    if (project.error && project.error.code === 'NOT_AUTHORIZED') {
      const teams = await fetch(`${base}/v2/teams`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json());
      const team = teams.teams?.find((t) => t.slug === 'patrick-duchesneaus-projects') ?? teams.teams?.[0];
      if (team) {
        project = await getProject(team.id);
      }
    }
    if (project.error) {
      console.error(project.error.message || project.error);
      process.exit(1);
    }
    const link = project.link;
    if (!link) {
      console.log('Git: not connected (no link). Connect in Vercel → Kinetix → Settings → Git.');
      process.exit(0);
    }
    const repo = link.repo ?? '(no repo name)';
    const branch = link.productionBranch ?? '(no production branch)';
    const type = link.type ?? 'git';
    console.log('Git: connected');
    console.log('  type:    ', type);
    console.log('  repo:    ', link.org ? `${link.org}/${repo}` : repo);
    console.log('  productionBranch:', branch);
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
})();
