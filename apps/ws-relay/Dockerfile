# Stage 1: Build workspace dependencies
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm

WORKDIR /app

# Copy lockfile and package configurations
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY apps/ws-relay/package.json ./apps/ws-relay/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy codebase
COPY packages/ ./packages/
COPY apps/ws-relay/ ./apps/ws-relay/

# Generate Prisma client and build packages
RUN pnpm --filter @docsync/db prisma generate
RUN pnpm --filter @docsync/shared build
RUN pnpm --filter ws-relay build

# Stage 2: Runtime image
FROM node:20-alpine AS runner
RUN npm install -g pnpm
WORKDIR /app

# Copy built code and dependencies from builder
COPY --from=builder /app /app

ENV PORT=4444
ENV NODE_ENV=production

EXPOSE 4444

WORKDIR /app/apps/ws-relay
CMD ["pnpm", "start"]
