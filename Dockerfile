# syntax=docker/dockerfile:1.7

###############################################################################
# Stage 1: install dependencies and build both backend and frontend bundles.
###############################################################################
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies first to leverage Docker layer caching.
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY tsconfig*.json vite.config.ts postcss.config.mjs tailwind.config.mjs components.json ./
COPY sha3_wasm_bg.*.wasm ./
COPY backend ./backend
COPY frontend ./frontend
COPY scripts ./scripts

RUN npm run build

###############################################################################
# Stage 2: lean runtime image. Only ships compiled output and prod deps.
###############################################################################
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    CHAT2API_DATA_DIR=/data

# Only the runtime needs prod dependencies.
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund && \
    npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/sha3_wasm_bg.*.wasm ./

# Persist user data (provider accounts, logs, encryption key) on a volume.
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8080

# Drop to a non-root user for safety.
RUN addgroup -S chat2api && adduser -S chat2api -G chat2api && \
    chown -R chat2api:chat2api /app /data
USER chat2api

CMD ["node", "dist/backend/index.js"]
