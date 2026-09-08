# getownly API — built from the workspace root, not from backend/.
#
#   docker build -f backend/Dockerfile -t getownly-api .
#
# The build context has to be the repository root because this package depends
# on @getownly/shared, and pnpm resolves that through pnpm-workspace.yaml.
#
# node:22-slim rather than alpine: bcrypt is a native module and Prisma needs
# OpenSSL, and both are far less trouble against glibc than against musl.

# --- deps -------------------------------------------------------------------
# Only the manifests are copied first, so the install layer is reused whenever
# source changes but dependencies do not.
FROM node:22-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# The backend postinstall runs `prisma generate`, which needs the schema.
COPY backend/prisma backend/prisma

# --ignore-scripts on the first pass: the frontend's own postinstall has
# nothing to do here, and prisma generate runs explicitly in the build stage
# once the schema is definitely in place.
RUN pnpm install --frozen-lockfile --ignore-scripts

# --- build ------------------------------------------------------------------
FROM deps AS build
WORKDIR /app

COPY packages/shared packages/shared
COPY backend backend

# @getownly/shared compiles to dist/ and the API imports it from there, so it
# has to be built before the API is.
RUN pnpm --filter @getownly/shared build \
  && pnpm --filter backend exec prisma generate \
  && pnpm --filter backend build

# --- runtime ----------------------------------------------------------------
# No corepack here on purpose: pnpm is a build-time tool, and enabling it at
# runtime makes the container fetch pnpm on first start — a network call that
# would fail on an offline machine on demo day. The commands below run the
# binaries pnpm already linked into node_modules/.bin at build time.
FROM node:22-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production

# The whole tree is copied rather than a pruned subset: pnpm's node_modules is
# a symlink farm into .pnpm, and copying pieces of it out of order produces an
# image that installs cleanly and then cannot resolve anything at runtime. A
# larger image is a fair price for one that demonstrably starts.
COPY --from=build /app /app

# Nothing here needs root.
USER node

EXPOSE 4000

# Migrations run on start, so `docker compose --profile full up` against an
# empty database brings up a working system rather than one that needs a
# second manual step. `migrate deploy` only applies committed migrations — it
# never resets and never generates SQL of its own.
CMD ["sh", "-c", "cd /app/backend && node_modules/.bin/prisma migrate deploy && node dist/main"]
