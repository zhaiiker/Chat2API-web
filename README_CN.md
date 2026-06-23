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
- **会话管理** — 自动清理供应商会话，支持批量删除
- **API Key 管理** — 生成和管理代理认证密钥
- **仪表盘** — 实时请求流量、延迟、成功率监控
- **请求日志** — 详细日志记录，便于调试和分析
- **多语言** — 英文和简体中文
- **深色/浅色主题** — 现代响应式界面

## 🤖 支持的服务商

| 服务商 | 认证类型 | 模型 |
| --- | --- | --- |
| DeepSeek | User Token | deepseek-v4-pro, deepseek-v4-flash |
| GLM | Refresh Token | GLM-5.2 |
| Kimi | JWT Token | Kimi-K2.6 |
| MiniMax | JWT Token | MiniMax-M2.7 |
| Perplexity | Session Token | Auto（免费） |
| Qwen（国内版） | SSO Ticket | Qwen3.6, Qwen3.7-Max, Qwen3.5-Flash, Qwen3-Max, Qwen3-Coder |
| Qwen AI（国际版） | JWT Token | Qwen3.7-Max, Qwen3.6-Plus, Qwen3.6-35B-A3B, Qwen3.6-27B, Qwen3-Coder |
| Z.ai | JWT Token | GLM-5.2, GLM-5-Turbo, GLM-5V-Turbo, GLM-5, GLM-4.7 |
| Mimo | Service Token | MiMo 模型 |

## 📥 安装部署

### 方式一：Docker 部署（推荐）

最简单的部署方式，只需要 Docker 和 Docker Compose。

```bash
# 克隆仓库
git clone https://github.com/zhaiiker/Chat2API-web.git
cd Chat2API-web

# 构建并后台启动
docker compose up -d --build

# 查看日志
docker compose logs -f chat2api
```

服务启动后访问 `http://你的服务器:8080`。

**自定义端口：**

编辑 `docker-compose.yml` 中的 `ports` 部分：

```yaml
ports:
  - "9000:8080"  # 将宿主机 9000 端口映射到容器 8080 端口
```

**环境变量配置（可选）：**

在项目根目录创建 `.env` 文件：

```env
CHAT2API_MANAGEMENT_SECRET=你的管理密钥
CHAT2API_ENCRYPTION_KEY=你的加密密钥
```

生成安全密钥：

```bash
openssl rand -hex 32
```

**数据持久化：** `docker-compose.yml` 使用命名卷（`chat2api-data`）映射到容器内的 `/data` 目录。所有配置、账户和日志在容器重启和重建后均不会丢失。

**常用 Docker 命令：**

```bash
# 停止服务
docker compose down

# 拉取更新后重新构建
git pull
docker compose up -d --build

# 查看实时日志
docker compose logs -f chat2api

# 重置数据（注意：会删除所有设置）
docker compose down -v
```

**国内 Docker Hub 加速（如遇网络问题）：**

如果构建时出现拉取镜像超时，配置国内镜像加速器：

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### 方式二：直接部署

**环境要求：** Node.js 20+（推荐 LTS 22.x）、npm、Git

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

### 方式二：bin直接部署
拷贝zip 
chat2api-frontend-dist.zip
chat2api-web-linux-x64.zip
到服务器目录例如/etc/app/chat2api
解压chat2api-web-linux-x64.zip二进制文件放在/etc/app/chat2api
创建目录 mkdir -p /etc/app/chat2api/dist/frontend
解压chat2api-frontend-dist.zip 全部文件放在新建的目录

结构如下
```
/etc/app/
└── chat2api/
    ├── chat2api-web         <-- 你的二进制执行文件
    └── dist/
        └── frontend/        <-- 把解压出来的网页文件丢进这里
            ├── index.html
            ├── assets/
            └── ...
```
然后直接启动./chat2api-web
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

# 更新后重启
git pull && npm ci && npm run build
pm2 restart chat2api
```

### 方式三：开发模式

**环境要求：** Node.js 20+、npm

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
| `CHAT2API_DATA_DIR` | `~/.chat2api` | 数据目录（Docker: `/data`） |
| `CHAT2API_MANAGEMENT_SECRET` | _（自动生成）_ | 管理 API 密钥（建议固定） |
| `CHAT2API_ENCRYPTION_KEY` | _（自动生成）_ | 凭证加密密钥（建议固定） |

> **提示：** 生产环境中建议始终固定 `CHAT2API_MANAGEMENT_SECRET` 和 `CHAT2API_ENCRYPTION_KEY`，否则每次冷启动都会重新生成，导致现有会话和加密凭证失效。

## 🔧 使用方法

1. 打开 Web UI → 添加供应商（如 DeepSeek）
2. 从供应商网站粘贴 Token
3. 在 API Key 管理页面创建一个 API Key
4. 将 AI 客户端指向 `http://你的服务器:8080/v1`，填入 API Key

支持 Cherry Studio、Chatbox、OpenCat、Cline、Roo-Code 或任何 OpenAI 兼容工具。

## 🔄 v1.4.0 更新内容

- **模型更新** — 所有供应商同步至最新上游模型（DeepSeek V4、GLM-5.2、Qwen3.6/3.7、MiniMax-M2.7 等）
- **会话管理** — Qwen 和 Kimi 新增批量会话列表及删除功能
- **DeepSeek 搜索增强** — 改进搜索结果合并、引用处理和语义模型检测
- **Z.ai 验证码支持** — 新增 `captcha_verify_param` 凭证字段
- **思考模式改进** — 所有供应商的思考/搜索/折叠模式检测优化
- **浏览器指纹更新** — DeepSeek、Z.ai 更新至 Chrome 148 UA 和请求头.

## 友情链接

- [LINUX DO](https://linux.do/) —— 新的理想型社区，技术爱好者的聚集地。

## 📄 许可证

[GPL-3.0](LICENSE)
