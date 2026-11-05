# Single-container build: API + web app on one port (local testing or one-service deploys).
# For the usual two-service Easypanel setup use backend/Dockerfile and frontend/Dockerfile.
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Same origin: the web app calls /api on the server that serves it
ENV VITE_API_URL=/api
RUN npm run build

FROM node:20-bookworm-slim
ENV NODE_ENV=production PORT=5000 SERVE_FRONTEND_DIR=/app/web \
    PUPPETEER_SKIP_DOWNLOAD=true PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-noto-core fonts-dejavu-core tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY backend/ ./
COPY --from=web /web/dist /app/web
RUN mkdir -p uploads
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
