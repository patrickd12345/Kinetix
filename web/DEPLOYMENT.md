# Kinetix Web App - Deployment Guide

## Hosting Options

### Vercel (Recommended - Zero Config)

**Setup:**
1. Install Vercel CLI: `npm i -g vercel`
2. From `web/` directory, run: `vercel`
3. Follow prompts to link project
4. Deploy: `vercel --prod`

**Or use Vercel Dashboard:**
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Set root directory to `web/`
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy!

**Environment Variables (if needed):**
- `VITE_OLLAMA_API_URL` - Ollama API URL (default: http://localhost:11434/api/generate)
- `VITE_OLLAMA_MODEL` - Ollama model name (default: llama3.2)

**Note:** For local LLM, users will need to run Ollama locally. For production, you might want to set up a hosted Ollama instance or use a different AI service.

### Netlify

**Setup:**
1. Install Netlify CLI: `npm i -g netlify-cli`
2. From `web/` directory, run: `netlify init`
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy: `netlify deploy --prod`

**Or use Netlify Dashboard:**
1. Go to [netlify.com](https://netlify.com)
2. Drag and drop the `web/dist` folder after building
3. Or connect GitHub repo and set:
   - Base directory: `web`
   - Build command: `npm run build`
   - Publish directory: `web/dist`

### GitHub Pages

**Setup:**
1. Update `vite.config.js` to set `base: '/your-repo-name/'`
2. Build: `npm run build`
3. Deploy `dist/` folder to `gh-pages` branch
4. Enable GitHub Pages in repo settings

**Or use GitHub Actions:**
- Create `.github/workflows/deploy.yml` with deployment workflow

### Cloudflare Pages

**Setup:**
1. Go to Cloudflare Dashboard → Pages
2. Connect GitHub repository
3. Set:
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `web`

## Local Development

```bash
cd web
npm install
npm run dev
```

## Building for Production

```bash
cd web
npm run build
```

Output will be in `web/dist/` directory.

## Important Notes

### Geolocation API
- Requires HTTPS in production (most hosting providers provide this)
- Users must grant location permissions
- May not work in some browsers without HTTPS

### Local LLM (Ollama) - Architecture Consideration

**Important:** A deployed webapp (on Vercel/Netlify) **cannot** connect to `localhost:11434` on the user's machine due to browser security.

**Options:**

1. **Local Development Mode (Recommended for Ollama)**
   - Run webapp locally: `npm run dev`
   - Run Ollama locally: `ollama serve`
   - Both on same machine = works perfectly
   - Best for privacy and local AI

2. **Deployed Webapp + Tunneling**
   - Deploy webapp to Vercel/Netlify
   - User runs Ollama locally
   - User sets up tunnel (ngrok/localtunnel) to expose Ollama
   - User configures webapp with tunnel URL
   - More complex but allows deployment

3. **Deployed Webapp + Hosted Ollama**
   - Deploy webapp to Vercel/Netlify
   - Set up Ollama on a server you control
   - Configure `VITE_OLLAMA_API_URL` to point to your server
   - Users connect to your hosted Ollama instance
   - Less private but easier for users

4. **PWA (Progressive Web App)**
   - Make webapp installable
   - Users install and run locally
   - Can connect to local Ollama
   - Best of both worlds

**Current Implementation:**
- Defaults to `localhost:11434` (works for local development)
- Falls back to rule-based analysis if Ollama unavailable
- Users can configure `VITE_OLLAMA_API_URL` for custom setup

**Recommendation:** For maximum privacy and simplicity, run the webapp locally when using Ollama.

### Browser Compatibility
- Modern browsers only (Chrome, Firefox, Safari, Edge)
- Geolocation API required
- LocalStorage for data persistence

## Current Status

- ✅ Vercel configuration ready
- ⚠️ No hosting deployed yet
- ⚠️ Ollama needs to be configured (local or hosted)

