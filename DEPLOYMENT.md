# Chat2API Web Deployment Guide

This document describes how to run the **Web edition** of Chat2API on a server
(VPS, container host, etc.) for 24/7 use. The legacy Electron desktop edition
is no longer required.

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Single Node.js process                  │
│ ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐  │
│ │ /v1/* OpenAI API │  │ /v0/management/* │  │ /  static  │  │
│ └──────────────────┘  └──────────────────┘  │   web UI   │  │
└─────────────────────────────────────────────┴────────────┴──┘
            ▲                    ▲                    ▲
            │                    │                    │
        AI clients          Browser (UI)       Browser (UI)
```

A single port serves three things:

1. **`/v1/*`** – the OpenAI-compatible proxy that AI clients talk to.
2. **`/v0/management/*`** – the management HTTP API used by the web UI to
   configure providers, accounts, API keys, view logs, etc. Protected by a
   bearer secret.
3. **`/`** – the built React UI (when `dist/frontend` is present).

## Quick start with Docker

```bash
# Build and start
docker compose up -d --build

# Watch the first-boot log to capture the auto-generated Management secret
docker compose logs -f chat2api
```

On first boot you will see something like:

```
================================================================
  First run detected.
  Open the web UI to create your administrator password.
  Until you do, the management API will reject every request
  except /v0/management/auth/{status,setup,login}.
================================================================
```

Open `http://your-server:8080/`. You will be greeted with a "Create
administrator password" screen — pick a password (8+ chars), submit, and
you are in. The password can be changed later from **Settings → Security →
Administrator Password**.

> **Tip:** in headless deployments you can skip the web first-run flow
> entirely by setting `CHAT2API_MANAGEMENT_SECRET` in `.env`. Chat2API
> then uses that value as the long-lived secret and treats setup as
> already done. You will still need to set a password from the UI later
> if you want a friendly login screen.

## Quick start without Docker

```bash
# 1. Install Node.js 18+ and clone the repository.
git clone https://github.com/zhaiiker/Chat2API-web.git
cd Chat2API-web

# 2. Install dependencies and build.
npm ci
npm run build

# 3. Optional: copy and edit environment defaults.
cp .env.example .env

# 4. Start.
npm start
```

The backend binds on `0.0.0.0:8080` by default.

## Persisting data

User data (encrypted credentials, configuration, logs) lives under
`CHAT2API_DATA_DIR` (default: `~/.chat2api`).

When deploying with Docker the compose file mounts a named volume at `/data`
so data survives container rebuilds. Back this directory up if you care
about your provider accounts and API keys.

## Reverse proxy / TLS

Chat2API itself speaks plain HTTP. For production deployments put it behind
a reverse proxy (Caddy / Nginx / Traefik / Cloudflare) that terminates TLS:

### Caddy example

```caddyfile
chat2api.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

### Nginx example

```nginx
server {
    listen 443 ssl http2;
    server_name chat2api.example.com;

    # ... certificate config ...

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE / streaming responses from /v1/chat/completions need a long timeout.
        proxy_read_timeout 300s;
        proxy_buffering off;
    }
}
```

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Address to bind. Use `127.0.0.1` if behind a reverse proxy on the same host. |
| `PORT` | `8080` | Port for the unified web UI + API. |
| `CHAT2API_DATA_DIR` | `~/.chat2api` | Directory to persist config, logs, and encryption key. |
| `CHAT2API_MANAGEMENT_SECRET` | _(auto)_ | Pin the management API secret. Recommended in production. |
| `CHAT2API_DISABLE_MANAGEMENT_API` | `0` | Set to `1` to disable the management API and web UI auth surface. |
| `CHAT2API_DISABLE_BOOKMARKLET` | `0` | Set to `1` to disable the bookmarklet OAuth ingest flow (`/v0/management/oauth/bookmarklet/*`). |
| `CHAT2API_ENCRYPTION_KEY` | _(auto)_ | Pin the credential encryption key. |
| `CHAT2API_FRONTEND_DIR` | _auto-detected_ | Path to the built frontend. Override only when running unconventionally. |

## Health and stats

- `GET /health` – returns proxy running status and aggregate stats.
- `GET /stats` – returns detailed counters (requests, latencies, etc.).

Wire these into your uptime / Prometheus stack for alerting.

## Running as a systemd service

```ini
# /etc/systemd/system/chat2api.service
[Unit]
Description=Chat2API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=chat2api
WorkingDirectory=/opt/chat2api
EnvironmentFile=/etc/chat2api.env
ExecStart=/usr/bin/node dist/backend/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now chat2api
sudo journalctl -u chat2api -f
```

## Migrating from the Electron desktop edition

Copy the contents of `~/.chat2api/` from your old machine to the new
deployment's `CHAT2API_DATA_DIR`. If you also bring over the
`.encryption_key` file your encrypted credentials will decrypt without
re-entry.


## Adding provider accounts (OAuth tokens)

The Electron edition used to spawn a Chromium window so you could log
into a provider (DeepSeek, GLM, Kimi, …) and have its token captured
automatically. The web edition replaces that with a **bookmarklet**: a
tiny `javascript:` link that you drag into your browser's bookmark bar
once and click after signing in. It reads the auth value out of
`localStorage` / `cookie` and POSTs it back to Chat2API for you — no
DevTools, no copy / paste.

### Recommended flow (bookmarklet)

1. **Add Provider → choose a built-in provider → OAuth Login tab.**
2. **Drag "Save to Chat2API" into your bookmark bar.** The button is a
   real `javascript:` link; the UI generates one bookmarklet per
   provider, embedding a one-time ticket so it can talk to Chat2API
   without exposing your management secret.
3. **Click "Open login page"** — the provider opens in a new browser tab.
4. **Sign in** as you normally would.
5. **Click the "Save to Chat2API" bookmark** while still on the
   provider's tab. The bookmarklet reads the right `localStorage` /
   cookie value and uploads it. The Chat2API tab automatically picks
   up the token, validates it against the provider's API, and saves
   the account.

If you can't drag the link (corporate browsers sometimes disable that),
fall back to **Manual Input** in the same dialog and paste the token by
hand from DevTools — the bookmarklet is purely a convenience layer on
top of the same `/v0/management/oauth/login_with_token` endpoint.

Tokens are persisted under `CHAT2API_DATA_DIR` encrypted with AES-256-GCM
using the same key chain described above (`CHAT2API_ENCRYPTION_KEY` or
the auto-generated `.encryption_key` file).

### Why a bookmarklet (and not a remote browser)

A server-side browser pipeline (a containerised browser exposed through
a remote-desktop web viewer, or Playwright running inside the Chat2API
image) would also automate token capture, but both options add roughly
~2 GB of image weight and a non-trivial attack surface. Every provider
Chat2API supports keeps its auth state in `localStorage` or cookies on
a single origin — the browser already has everything we need, the
server just has to receive a string. So the bookmarklet does it
directly from your normal browser, with zero extra containers.

### Tickets and the public ingest endpoint

When you open the OAuth Login tab the backend mints a short-lived
**ticket** (random 32-byte token, default TTL 10 minutes, single-use)
and bakes it into the bookmarklet. The bookmarklet then POSTs to:

```
POST /v0/management/oauth/bookmarklet/ingest
Content-Type: application/json
{ "ticket": "...", "credentials": { ... } }
```

That endpoint is the **only** management route that does not require
the bearer secret — the ticket is the auth, and it self-destructs on
first use or on TTL expiry. If you operate Chat2API behind a strict
CDN / WAF, allow `POST /v0/management/oauth/bookmarklet/ingest` from
the provider domains (DeepSeek, ChatGLM, Kimi, etc.) so the
bookmarklet's cross-origin `fetch` isn't blocked.

If you want to disable the bookmarklet flow entirely, set
`CHAT2API_DISABLE_BOOKMARKLET=1`. The ingest endpoint then refuses
every request with a 404 and the UI hides the "drag to bookmark bar"
button.

### Power users: a browser extension is the natural next step

If you find yourself adding accounts often, a small WebExtension that
watches the provider domains and forwards tokens automatically is a
thin layer on top of the same ingest endpoint. We don't ship one
today; open a feature request if you'd like to collaborate on it.
