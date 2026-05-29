# Chat2API Web

<p align="center">
  <img src="build/icons.png" alt="Chat2API Logo" width="128" height="128">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Release-v1.3.0-blue?style=flat-square&logo=github" alt="Release">
  <img src="https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square" alt="License">
  <br>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <img src="https://img.shields.io/badge/Platform-Linux%20%7C%20Windows%20%7C%20macOS-lightgrey?style=flat-square" alt="Platform">
</p>

<p align="center">
  <strong><a href="README_CN.md">中文</a></strong>
</p>

<p align="center">
  <strong>Multi-platform AI Service Unified Management Tool — Web Edition</strong>
</p>

<p align="center">
  Chat2API Web enables zero-cost access to leading AI models by leveraging official web UIs. Deploy on any server (VPS, NAS, local machine) and manage everything from a browser. Supports DeepSeek, GLM, Kimi, MiniMax, Perplexity, Qwen, Z.ai and more — making any OpenAI-compatible client work out of the box.
</p>

![Product Preview](docs/screenshots/preview.png)

## ✨ Features

- **Pure Web Architecture** — No Electron, no desktop app. Single Node.js process serves UI + API on one port
- **OpenAI Compatible API** — Standard `/v1/chat/completions` endpoint, works with any OpenAI client
- **Multi-Provider Support** — DeepSeek, GLM, Kimi, MiniMax, Perplexity, Qwen, Qwen AI, Z.ai, Mimo
- **Context Management** — Sliding window, token limit, and summary compression strategies
- **Function Calling** — Universal tool calling via prompt engineering, compatible with Cherry Studio, Kilo Code, Cline
- **Model Mapping** — Flexible model name mapping with wildcard and preferred provider/account
- **Load Balancing** — Round-robin, fill-first, and failover strategies across multiple accounts
- **API Key Management** — Generate and manage keys for proxy authentication
- **Dashboard** — Real-time request traffic, latency, and success rate monitoring
- **Request Logs** — Detailed logging for debugging and analysis
- **Multilingual** — English and Simplified Chinese
- **Dark/Light Theme** — Modern responsive UI

## 🤖 Supported Providers

| Provider         | Auth Type     | Models |
| ---------------- | ------------- | ------ |
| DeepSeek         | User Token    | DeepSeek-V3.2, V4 Pro/Flash |
| GLM              | Refresh Token | GLM-5, GLM-5-Flash |
| Kimi             | JWT Token     | Kimi-K2.6, K2.5 |
| MiniMax          | JWT Token     | MiniMax-M2.5 |
| Perplexity       | Session Token | Auto, Turbo, GPT-5, Claude Sonnet/Opus |
| Qwen (CN)        | SSO Ticket    | Qwen3.5-Plus, Qwen3-Coder |
| Qwen AI (Global) | JWT Token     | Qwen3.5-Plus, Qwen3-Max |
| Z.ai             | JWT Token     | GLM-5, GLM-4.7 |
| Mimo             | Service Token | MiMo models |

## 📥 Installation

### Option 1: Direct Deployment (Recommended)

**Requirements:** Node.js 20+, npm, Git

```bash
# Clone
git clone https://github.com/zhaiiker/Chat2API-web.git
cd Chat2API-web

# Install dependencies
npm ci

# Build frontend + backend
npm run build

# Start (default port 8080)
PORT=8080 node dist/backend/index.js

# Start (Windows PowerShell)
$env:PORT="8080"; $env:HOST="0.0.0.0"; node dist/backend/index.js

```

Open `http://your-server:8080` in a browser. On first visit you'll set an administrator password.

**Run with PM2 (recommended for production):**

```bash
npm install -g pm2

# Start
PORT=8080 pm2 start dist/backend/index.js --name chat2api

# Auto-start on boot
pm2 startup
pm2 save

# View logs
pm2 logs chat2api
```

### Option 2: Docker

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f chat2api
```

Or with custom port:

```bash
PORT=9000 docker compose up -d --build
```

The `docker-compose.yml` uses a named volume (`chat2api-data`) so data persists across container restarts.

### Option 3: Development Mode

```bash
npm ci
npm run dev
```

This starts both backend (port 8080) and frontend dev server (port 5173) with hot reload.

## ⚙️ Configuration

All configuration is done via environment variables or the `.env` file:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `CHAT2API_DATA_DIR` | `~/.chat2api` | Data directory |
| `CHAT2API_MANAGEMENT_SECRET` | _(auto)_ | Pin management API secret |
| `CHAT2API_ENCRYPTION_KEY` | _(auto)_ | Pin credential encryption key |

## 🔧 Usage

1. Open the web UI → Add a provider (e.g. DeepSeek)
2. Paste your token from the provider's website
3. Create an API Key in the API Key Management page
4. Point your AI client to `http://your-server:8080/v1` with the API key

Works with Cherry Studio, Chatbox, OpenCat, Cline, Roo-Code, or any OpenAI-compatible tool.

## 📄 License

[GPL-3.0](LICENSE)
