# Ollama Setup for Kinetix Web App

## What is Ollama?

Ollama is a tool that runs large language models (LLMs) locally on your computer. Kinetix uses it for AI-powered run analysis and coaching.

## Installation

### macOS
```bash
# Using Homebrew (recommended)
brew install ollama

# Or download from https://ollama.ai/download
```

### Linux
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### Windows
Download the installer from [ollama.ai/download](https://ollama.ai/download)

## Quick Start

1. **Install Ollama** (see above)

2. **Start Ollama service:**
   ```bash
   ollama serve
   ```
   This starts the Ollama server on `http://localhost:11434`

3. **Pull a model** (choose one):
   ```bash
   # Lightweight option (recommended for most users)
   ollama pull llama3.2
   
   # Or for better quality (requires more RAM)
   ollama pull llama3.1
   ```

4. **Verify it's working:**
   ```bash
   curl http://localhost:11434/api/tags
   ```
   Should return a list of available models.

5. **Use Kinetix Web App:**
   - **If running webapp locally:** Just open `http://localhost:5173` - it will automatically connect
   - **If using deployed webapp:** You'll need to set up a tunnel (see LOCAL_SETUP.md) or use a hosted Ollama instance
   - The AI Coach will automatically use your local Ollama instance
   - No API keys needed!

## Model Recommendations

- **llama3.2** (default) - Good balance of speed and quality, ~2GB RAM
- **llama3.1** - Better quality, ~4GB RAM
- **llama3.2:1b** - Fastest, ~1GB RAM (lower quality)

## Troubleshooting

### Ollama not found
- Make sure Ollama is installed and in your PATH
- Try restarting your terminal

### Connection refused
- Make sure `ollama serve` is running
- Check that port 11434 is not blocked by firewall

### Model not found
- Pull the model: `ollama pull llama3.2`
- Check available models: `ollama list`

### Slow responses
- Try a smaller model: `ollama pull llama3.2:1b`
- Close other applications to free up RAM
- Check system resources

## Custom Configuration

If you're running Ollama on a different port or URL, set environment variables in the web app:

```bash
# In your terminal before starting the web app
export VITE_OLLAMA_API_URL=http://localhost:11434/api/generate
export VITE_OLLAMA_MODEL=llama3.2
```

Or create a `.env` file in the `web/` directory:
```
VITE_OLLAMA_API_URL=http://localhost:11434/api/generate
VITE_OLLAMA_MODEL=llama3.2
```

## Running Ollama in Background

### macOS (using launchd)
Create `~/Library/LaunchAgents/com.ollama.server.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.ollama.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/ollama</string>
    <string>serve</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
```

Then load it:
```bash
launchctl load ~/Library/LaunchAgents/com.ollama.server.plist
```

### Linux (using systemd)
Create `/etc/systemd/system/ollama.service`:
```ini
[Unit]
Description=Ollama Service
After=network.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=your-username
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable ollama
sudo systemctl start ollama
```

## Privacy & Security

- ✅ All AI processing happens **locally** on your computer
- ✅ No data sent to external servers
- ✅ No API keys required
- ✅ Your run data stays private

## Fallback Behavior

If Ollama is not available, Kinetix will use rule-based analysis instead. The app will still work, but AI insights won't be available.

---

**Need help?** Check the [Ollama documentation](https://github.com/ollama/ollama) or open an issue.

