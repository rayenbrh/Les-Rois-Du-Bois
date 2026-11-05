# Les Rois Du Bois - web app (store + admin + POS)
# Build context: ./frontend
FROM node:20-alpine AS build
WORKDIR /app

# Backend API URL baked into the bundle at build time (set it as a build arg in Easypanel)
ARG VITE_API_URL=https://les-rois-du-bois-back.2bj94x.easypanel.host/api
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
RUN npm install -g serve@14.2.5 --no-audit --no-fund && apk add --no-cache tini
COPY --from=build /app/dist ./dist

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
# -s: single page app (every route serves index.html); serve.json sets cache headers
CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT}"]
