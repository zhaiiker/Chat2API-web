# Chat2API Web

<p align="center">
  <img src="build/icons.png" alt="Chat2API Logo" width="128" height="128">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Release-v1.4.0-blue?style=flat-square&logo=github" alt="Release">
  <img src="https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square" alt="License">
  <br>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js"></a>
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
- **Session Management** — Auto-cleanup of provider chat sessions, batch deletion support
- **API Key Management** — Generate and manage keys for proxy authentication
- **Dashboard** — Real-time request traffic, latency, and success rate monitoring
- **Request Logs** — Detailed logging for debugging and analysis
- **Multilingual** — English and Simplified Chinese
- **Dark/Light Theme** — Modern responsive UI

## 🤖 Supported Providers

| Provider | Auth Type | Models | Status |
| --- | --- | --- | --- |
| DeepSeek | User Token | deepseek-v4-pro, deepseek-v4-flash | Available |
| GLM | Refresh Token | GLM-5.1 | Available |
| Kimi | JWT Token | Kimi-K2.6 | Available |
| MiniMax | JWT Token | MiniMax-M2.7 | Available |
| Perplexity | Session Token | Auto (Free) | Available |
| Qwen (CN) | SSO Ticket | Qwen3.6, Qwen3.7-Max, Qwen3.5-Flash, Qwen3-Max, Qwen3-Coder | Available |
| Qwen AI (Global) | JWT Token | Qwen3.7-Max, Qwen3.6-Plus, Qwen3.6-35B-A3B, Qwen3.6-27B, Qwen3-Coder | Available |
| Z.ai | JWT Token | GLM-5.1, GLM-5-Turbo, GLM-5V-Turbo, GLM-5, GLM-4.7 | Temporarily unavailable due to frontend captcha risk control |
| Mimo | Service Token | MiMo models | Available |

## 📥 Installation

### Option 1: Docker (Recommended)

The simplest way to deploy. Requires only Docker and Docker Compose.

```bash
# Clone the repo
git clone https://github.com/zhaiiker/Chat2API-web.git
cd Chat2API-web

# Build and start in background
docker compose up -d --build

# View logs
docker compose logs -f chat2api
```

The service will be available at `http://your-server:8080`.

**Custom port:**

```bash
# Edit docker-compose.yml ports section, or use:
docker compose up -d --build
# Then map host port as needed
```

To change the exposed port, edit `docker-compose.yml`:

```yaml
ports:
  - "9000:8080"  # Map host port 9000 to container port 8080
```

**Environment variables (optional):**

Create a `.env` file in the project root:

```env
CHAT2API_MANAGEMENT_SECRET=your-secret-here
CHAT2API_ENCRYPTION_KEY=your-encryption-key-here
```

Or generate a secure secret:

```bash
openssl rand -hex 32
```

**Data persistence:** The `docker-compose.yml` uses a named volume (`chat2api-data`) mapped to `/data` inside the container. All configuration, accounts, and logs are preserved across container restarts and rebuilds.

**Common Docker commands:**

```bash
# Stop the service
docker compose down

# Rebuild after pulling updates
git pull
docker compose up -d --build

# View real-time logs
docker compose logs -f chat2api

# Reset data (caution: deletes all settings)
docker compose down -v
```

### Option 2: Direct Deployment

**Requirements:** Node.js 20+ (LTS recommended: 22.x), npm, Git

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

# Restart after update
git pull && npm ci && npm run build
pm2 restart chat2api
```

### Option 3: Development Mode

**Requirements:** Node.js 20+, npm

```bash
npm ci
npm run dev
```

This starts both backend (port 8080) and frontend dev server (port 5173) with hot reload.

## ⚙️ Configuration

All configuration is done via environment variables or the `.env` file in the project root:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8080` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `CHAT2API_DATA_DIR` | `~/.chat2api` | Data directory (Docker: `/data`) |
| `CHAT2API_MANAGEMENT_SECRET` | _(auto-generated)_ | Management API secret (pin for persistence) |
| `CHAT2API_ENCRYPTION_KEY` | _(auto-generated)_ | Credential encryption key (pin for persistence) |

> **Tip:** In production, always pin `CHAT2API_MANAGEMENT_SECRET` and `CHAT2API_ENCRYPTION_KEY` so they survive container restarts. Auto-generated keys change on each cold start, which would invalidate existing sessions and encrypted credentials.

## 🔧 Usage

1. Open the web UI → Add a provider (e.g. DeepSeek)
2. Paste your token from the provider's website
3. Create an API Key in the API Key Management page
4. Point your AI client to `http://your-server:8080/v1` with the API key

Works with Cherry Studio, Chatbox, OpenCat, Cline, Roo-Code, or any OpenAI-compatible tool.

## 🔄 What's New in v1.4.0

- **Model Updates** — All providers synced to latest upstream models (DeepSeek V4, GLM-5.1, Qwen3.6/3.7, MiniMax-M2.7, etc.)
- **Session Management** — Qwen and Kimi now support batch session listing and deletion
- **DeepSeek Search Enhancement** — Improved search result merging, citation handling, and semantic model detection
- **Thinking Mode Improvements** — Better thinking/search/fold mode detection across all providers
- **Updated Browser Fingerprints** — Chrome 148 UA and headers for DeepSeek, Z.ai

## 友情链接

- [LINUX DO](https://linux.do/) —— 新的理想型社区，技术爱好者的聚集地。

## 📄 License

[GPL-3.0](LICENSE)
