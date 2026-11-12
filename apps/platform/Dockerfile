# syntax=docker/dockerfile:1
# One image, three process roles. Build from the repository root:
#   docker build -f apps/platform/Dockerfile -t cloudpulse-platform .
#   docker run cloudpulse-platform dist/main.gateway.js
#   docker run cloudpulse-platform dist/main.worker.js --role=cost

FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/platform/package.json apps/platform/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/platform apps/platform
RUN pnpm --filter @cloudpulse/platform... run build \
 && pnpm --filter @cloudpulse/platform deploy --prod --legacy /out

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000 3002 3003
ENTRYPOINT ["node", "--enable-source-maps", "--import", "./dist/telemetry.js"]
CMD ["dist/main.api.js"]
