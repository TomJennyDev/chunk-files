# ============================================
# Search Service Dockerfile (multi-stage)
# ============================================

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS dependencies
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY libs/shared/package.json libs/shared/
COPY apps/search-service/package.json apps/search-service/
RUN pnpm install --frozen-lockfile

FROM base AS development
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/libs/shared/node_modules ./libs/shared/node_modules
COPY --from=dependencies /app/apps/search-service/node_modules ./apps/search-service/node_modules
COPY libs/shared/ libs/shared/
COPY apps/search-service/ apps/search-service/
WORKDIR /app/apps/search-service
CMD ["npx", "nest", "start", "--watch"]

FROM dependencies AS build
COPY libs/shared/ libs/shared/
COPY apps/search-service/ apps/search-service/
RUN cd libs/shared && pnpm run build
RUN cd apps/search-service && pnpm run build

FROM node:20-alpine AS production
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/libs/shared/dist ./libs/shared/dist
COPY --from=build /app/libs/shared/package.json ./libs/shared/
COPY --from=build /app/apps/search-service/dist ./apps/search-service/dist
COPY --from=build /app/apps/search-service/package.json ./apps/search-service/
WORKDIR /app/apps/search-service
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
