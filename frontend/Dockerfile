# getownly web — built from the workspace root, not from frontend/.
#
#   docker build -f frontend/Dockerfile -t getownly-web .
#
# Same reason as the API: this package depends on @getownly/shared, which only
# resolves through pnpm-workspace.yaml at the root.
#
# NEXT_PUBLIC_* values are read by the *browser*, so Next inlines them into the
# bundle at build time. They arrive as build args rather than as runtime
# environment variables, because by the time the container starts it is far too
# late for them to have any effect.

# --- deps -------------------------------------------------------------------
FROM node:22-slim AS deps
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/

RUN pnpm install --frozen-lockfile --ignore-scripts

# --- build ------------------------------------------------------------------
FROM deps AS build
WORKDIR /app

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_SITE_NAME=getownly
ARG NEXT_PUBLIC_MINIO_ENDPOINT=localhost
ARG NEXT_PUBLIC_MINIO_PORT=9000
ARG NEXT_PUBLIC_MINIO_USE_SSL=false

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME \
    NEXT_PUBLIC_MINIO_ENDPOINT=$NEXT_PUBLIC_MINIO_ENDPOINT \
    NEXT_PUBLIC_MINIO_PORT=$NEXT_PUBLIC_MINIO_PORT \
    NEXT_PUBLIC_MINIO_USE_SSL=$NEXT_PUBLIC_MINIO_USE_SSL \
    NEXT_TELEMETRY_DISABLED=1

COPY packages/shared packages/shared
COPY frontend frontend

RUN pnpm --filter @getownly/shared build \
  && pnpm --filter frontend build

# --- runtime ----------------------------------------------------------------
# No corepack at runtime — see the note in backend/Dockerfile.
FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app /app

USER node

EXPOSE 3000

# API_BASE_URL (no NEXT_PUBLIC_ prefix) is read by Server Components at
# request time, so unlike the values above it can — and must — be set on the
# container: inside the compose network the API is `api:4000`, while the
# browser still reaches it on localhost.
CMD ["sh", "-c", "cd /app/frontend && node_modules/.bin/next start -p 3000"]
