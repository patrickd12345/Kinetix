# Running Kinetix Web App Locally

## Why Run Locally?

The Kinetix web app is designed to work with Ollama running on your local machine. For the best experience with AI features, run both the webapp and Ollama locally.

## Quick Start

### 1. Install Dependencies

```bash
cd web
npm install
```

### 2. Start Ollama

In a separate terminal:
```bash
# Install Ollama if you haven't (see OLLAMA_SETUP.md)
ollama serve

# Pull a model
ollama pull llama3.2
```

### 3. Start the Web App

```bash
cd web
npm run dev
```

The app will open at `http://localhost:5173` (or similar port)

### 4. Use the App

- The webapp will automatically connect to your local Ollama instance
- All AI processing happens on your machine
- No data leaves your computer

## Configuration

### Custom Ollama URL

If Ollama is running on a different port or machine, create a `.env` file:

```bash
# web/.env
VITE_OLLAMA_API_URL=http://localhost:11434/api/generate
VITE_OLLAMA_MODEL=llama3.2
```

### Using a Tunnel (Advanced)

If you want to use a deployed webapp with local Ollama:

1. **Set up tunnel:**
   ```bash
   # Using ngrok
   ngrok http 11434
   
   # Or using localtunnel
   npx localtunnel --port 11434
   ```

2. **Configure webapp:**
   - Set `VITE_OLLAMA_API_URL` to the tunnel URL
   - Example: `VITE_OLLAMA_API_URL=https://abc123.ngrok.io/api/generate`

## Development vs Production

### Development (Local)
- ✅ Best for Ollama integration
- ✅ Privacy (everything local)
- ✅ No deployment needed
- ✅ Easy to test and iterate

### Production (Deployed)
- ⚠️ Requires tunneling or hosted Ollama
- ⚠️ More complex setup
- ✅ Accessible from anywhere
- ✅ No local setup for users

## Recommended Workflow

1. **Development:** Run locally with Ollama
2. **Testing:** Test locally, then deploy
3. **Production Options:**
   - Keep it local (users run locally)
   - Deploy + provide tunneling instructions
   - Deploy + host Ollama on a server

## Troubleshooting

### Can't connect to Ollama
- Make sure `ollama serve` is running
- Check that port 11434 is not blocked
- Verify Ollama is accessible: `curl http://localhost:11434/api/tags`

### CORS errors
- Ollama should allow CORS by default
- If issues, check Ollama configuration

### Slow responses
- Try a smaller model: `ollama pull llama3.2:1b`
- Check system resources (RAM, CPU)

---

**For deployment options, see `DEPLOYMENT.md`**

