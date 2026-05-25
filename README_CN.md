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
  <strong><a href="README.md">English</a></strong>
</p>

<p align="center">
  <strong>多平台 AI 服务统一管理工具 — Web 版</strong>
</p>

<p align="center">
  Chat2API Web 通过驱动各大模型的官方 Web UI，实现 0 成本接入主流 AI 大模型。部署在任意服务器（VPS、NAS、本地机器）上，通过浏览器管理一切。支持 DeepSeek、GLM、Kimi、MiniMax、Perplexity、Qwen、Z.ai 等渠道，可无缝连接任何 OpenAI 兼容客户端。
</p>

![产品预览](docs/screenshots/preview.png)

## ✨ 功能特性

- **纯 Web 架构** — 无需 Electron，无需桌面应用。单个 Node.js 进程在一个端口上同时提供 UI 和 API
- **OpenAI 兼容 API** — 标准 `/v1/chat/completions` 接口，任何 OpenAI 客户端即可使用
- **多服务商支持** — DeepSeek、GLM、Kimi、MiniMax、Perplexity、Qwen、Qwen AI、Z.ai、Mimo
- **上下文管理** — 滑动窗口、Token 限制、摘要压缩策略
- **工具调用** — 通过提示词工程为所有模型提供通用工具调用能力，兼容 Cherry Studio、Kilo Code、Cline
- **模型映射** — 灵活的模型名称映射，支持通配符和首选服务商/账户
- **负载均衡** — 轮询、填充优先、故障转移策略，跨多账户分发请求
- **API Key 管理** — 生成和管理代理认证密钥
- **仪表盘** — 实时请求流量、延迟、成功率监控
- **请求日志** — 详细日志记录，便于调试和分析
- **多语言** — 英文和简体中文
- **深色/浅色主题** — 现代响应式界面

## 🤖 支持的服务商

| 服务商 | 认证类型 | 模型 |
| --- | --- | --- |
| DeepSeek | User Token | DeepSeek-V3.2、V4 Pro/Flash |
| GLM | Refresh Token | GLM-5、GLM-5-Flash |
| Kimi | JWT Token | Kimi-K2.6、K2.5 |
| MiniMax | JWT Token | MiniMax-M2.5 |
| Perplexity | Session Token | Auto、Turbo、GPT-5、Claude Sonnet/Opus |
| Qwen（国内版） | SSO Ticket | Qwen3.5-Plus、Qwen3-Coder |
| Qwen AI（国际版） | JWT Token | Qwen3.5-Plus、Qwen3-Max |
| Z.ai | JWT Token | GLM-5、GLM-4.7 |
| Mimo | Service Token | MiMo 模型 |

## 📥 安装

### 方式一：直接部署（推荐）

**环境要求：** Node.js 20+、npm、Git

```bash
# 克隆
git clone https://github.com/zhaiiker/Chat2API-web.git
cd Chat2API-web

# 安装依赖
npm ci

# 编译前端 + 后端
npm run build

# 启动（默认端口 8080）
PORT=8080 node dist/backend/index.js
```

浏览器打开 `http://你的服务器:8080`，首次访问时设置管理员密码。

**使用 PM2 保活（生产推荐）：**

```bash
npm install -g pm2

# 启动
PORT=8080 pm2 start dist/backend/index.js --name chat2api

# 开机自启
pm2 startup
pm2 save

# 查看日志
pm2 logs chat2api
```

### 方式二：Docker 部署

```bash
# 构建并启动
docker compose up -d --build

# 查看日志
docker compose logs -f chat2api
```

自定义端口：

```bash
PORT=9000 docker compose up -d --build
```

`docker-compose.yml` 使用命名卷（`chat2api-data`），数据在容器重启后不会丢失。

### 方式三：开发模式

```bash
npm ci
npm run dev
```

同时启动后端（端口 8080）和前端开发服务器（端口 5173），支持热重载。

## ⚙️ 配置

通过环境变量或项目根目录 `.env` 文件配置：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8080` | 服务端口 |
| `HOST` | `0.0.0.0` | 绑定地址 |
| `CHAT2API_DATA_DIR` | `~/.chat2api` | 数据目录 |
| `CHAT2API_MANAGEMENT_SECRET` | _（自动生成）_ | 固定管理 API 密钥 |
| `CHAT2API_ENCRYPTION_KEY` | _（自动生成）_ | 固定凭证加密密钥 |

## 🔧 使用方法

1. 打开 Web UI → 添加供应商（如 DeepSeek）
2. 从供应商网站粘贴 Token
3. 在 API Key 管理页面创建一个 API Key
4. 将 AI 客户端指向 `http://你的服务器:8080/v1`，填入 API Key

支持 Cherry Studio、Chatbox、OpenCat、Cline、Roo-Code 或任何 OpenAI 兼容工具。

## 📄 许可证

[GPL-3.0](LICENSE)
