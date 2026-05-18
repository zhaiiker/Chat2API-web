# Chat2API 架构迁移记录：Electron 转 Web/Backend

本文档用于记录将 Chat2API 从 Electron 架构迁移至 `纯 Web 前端 + Node.js 后端` 架构的详细进度与修改项，防止长流程导致记忆丢失。

## 整体阶段划分

- ✅ Phase 1: 后端基础与数据存储解耦 (Completed)
- ✅ Phase 2: API 与 IPC 迁移 (Completed)
- ✅ Phase 3: 前端重构 (Completed)
- ✅ Phase 4: 目录重组与清理 (Completed)

---

## 详细进度记录

### Phase 1: 后端基础与数据存储解耦 (✅ Completed)

1. **移除 electron-store 和 safeStorage**
   - **文件**: `backend/store/store.ts` (原 `src/main/store/store.ts`)
   - **修改**: 引入 `conf` 替代 `electron-store`。利用 Node.js 原生的 `crypto` 模块实现 AES-256-GCM 算法对敏感凭据进行加解密。

2. **剥离 Electron 依赖与创建后端入口**
   - **文件**: `backend/index.ts` (原 `src/main/index.ts`)
   - **修改**: 删除了 Electron 生命周期、托盘和更新逻辑。重写为纯 Node.js 后端服务入口。

### Phase 2: API 与 IPC 迁移 (✅ Completed)

1. **移除所有 IPC 文件**
   - 删除了 `src/main/ipc`。

2. **补齐 Management API 路由**
   - 新增 OAuth、Logs、System Prompts、App 基础路由到 `/v0/management/`。

### Phase 3: 前端重构 (✅ Completed)

1. **构建前端 HTTP API 客户端**
   - 文件: `frontend/src/services/api.ts`
   - 实现: 封装了 Axios 实例，自动处理 `managementApiSecret` 鉴权头。

2. **重构 Zustand Stores**
   - 修改了 `frontend/src/stores/*.ts`，将 `window.electronAPI` 替换为 `ApiService`。

3. **鉴权机制与 UI 调整**
   - 实现了 `AuthProvider` 组件，处理 API Secret 登录。移除了 Electron 专有的 `TrayView`。

### Phase 4: 目录重构与清理 (✅ Completed)

1. **重组项目目录结构**
   - 后端移动到 `backend/`，前端移动到 `frontend/`。

2. **依赖与构建工具更新**
   - 文件: `package.json`, `vite.config.ts`, `tsconfig.json`
   - 修改: 移除了所有 `electron` 相关依赖。配置标准 `Vite` 进行构建和代理。

---

## 🚀 运行方式

- **开发环境**: `npm run dev` (通过 `concurrently` 同时启动前后端)
  - 后端: `npm run dev:backend` (8080 端口)
  - 前端: `npm run dev:frontend` (5173 端口)
- **生产构建**: `npm run build`
- **生产运行**: `npm start`
