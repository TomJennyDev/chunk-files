# ============================================
# Upload Service Dockerfile (multi-stage)
# ============================================

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS dependencies
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY libs/shared/package.json libs/shared/
COPY apps/upload-service/package.json apps/upload-service/
RUN pnpm install --frozen-lockfile

FROM base AS development
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/libs/shared/node_modules ./libs/shared/node_modules
COPY --from=dependencies /app/apps/upload-service/node_modules ./apps/upload-service/node_modules
COPY libs/shared/ libs/shared/
COPY apps/upload-service/ apps/upload-service/
WORKDIR /app/apps/upload-service
CMD ["npx", "nest", "start", "--watch"]

FROM dependencies AS build
COPY libs/shared/ libs/shared/
COPY apps/upload-service/ apps/upload-service/
RUN cd libs/shared && pnpm run build
RUN cd apps/upload-service && pnpm run build

FROM node:20-alpine AS production
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/libs/shared/dist ./libs/shared/dist
COPY --from=build /app/libs/shared/package.json ./libs/shared/
COPY --from=build /app/apps/upload-service/dist ./apps/upload-service/dist
COPY --from=build /app/apps/upload-service/package.json ./apps/upload-service/
WORKDIR /app/apps/upload-service
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
