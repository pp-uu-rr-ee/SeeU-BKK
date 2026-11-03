# API server image (Render or any Docker host). Build from the repository root:
#   docker build -f apps/server/Dockerfile -t seeu-server .
FROM oven/bun:1.2.21

WORKDIR /app

# Workspace manifests first, so the dependency layer is reused when only code changes
COPY package.json bun.lock bunfig.toml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json

# Root + server dependencies only. The root workspace is needed too: the server imports
# packages declared there (e.g. @hono/zod-validator)
RUN bun install --frozen-lockfile --production --filter './' --filter server

COPY apps/server/tsconfig.json apps/server/tsconfig.json
COPY apps/server/src apps/server/src

ENV NODE_ENV=production
WORKDIR /app/apps/server
USER bun
EXPOSE 3000

# Bun runs the TypeScript entry directly and listens on $PORT (Render sets it; defaults to 3000)
CMD ["bun", "run", "src/index.ts"]
