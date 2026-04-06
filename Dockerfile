# ── Dashboard build ──
FROM node:20-alpine AS dashboard-build
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ .
ENV VITE_API_URL=
ENV VITE_WS_URL=
RUN npm run build

# ── Super dashboard build ──
FROM node:20-alpine AS super-dashboard-build
WORKDIR /app/super-dashboard
COPY super-dashboard/package*.json ./
RUN npm ci
COPY super-dashboard/ .
ENV VITE_API_URL=
ENV VITE_WS_URL=
RUN npm run build

# ── Backend build ──
FROM node:20-alpine AS backend-build
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npm run build

# ── Final image ──
FROM node:20-alpine
WORKDIR /app
COPY --from=backend-build /app/dist ./dist
COPY --from=backend-build /app/node_modules ./node_modules
COPY --from=backend-build /app/package.json ./

# Include source + drizzle config for db:push at startup
COPY --from=backend-build /app/src ./src
COPY --from=backend-build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=backend-build /app/tsconfig.json ./tsconfig.json

# Landing pages
COPY landing/ ./public/landing/

# Dashboard builds
COPY --from=dashboard-build /app/dashboard/dist ./public/dashboard
COPY --from=super-dashboard-build /app/super-dashboard/dist ./public/super-dashboard

# APK (optional)
COPY backend/public/ ./public/

# Startup script: push schema, seed, then start
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production
EXPOSE ${PORT:-3000}
CMD ["./start.sh"]
