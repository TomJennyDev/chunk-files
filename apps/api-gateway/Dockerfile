# ============================================
# API Gateway Dockerfile (multi-stage)
# ============================================

# --- Base ---
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# --- Dependencies ---
FROM base AS dependencies
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY libs/shared/package.json libs/shared/
COPY apps/api-gateway/package.json apps/api-gateway/
RUN pnpm install --frozen-lockfile

# --- Development ---
FROM base AS development
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/libs/shared/node_modules ./libs/shared/node_modules
COPY --from=dependencies /app/apps/api-gateway/node_modules ./apps/api-gateway/node_modules
COPY libs/shared/ libs/shared/
COPY apps/api-gateway/ apps/api-gateway/
WORKDIR /app/apps/api-gateway
CMD ["npx", "nest", "start", "--watch"]

# --- Build ---
FROM dependencies AS build
COPY libs/shared/ libs/shared/
COPY apps/api-gateway/ apps/api-gateway/
RUN cd libs/shared && pnpm run build
RUN cd apps/api-gateway && pnpm run build

# --- Production ---
FROM node:20-alpine AS production
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/libs/shared/dist ./libs/shared/dist
COPY --from=build /app/libs/shared/package.json ./libs/shared/
COPY --from=build /app/apps/api-gateway/dist ./apps/api-gateway/dist
COPY --from=build /app/apps/api-gateway/package.json ./apps/api-gateway/
WORKDIR /app/apps/api-gateway
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main.js"]
