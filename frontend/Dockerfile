FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS builder
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_DIST_DIR=.next
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# No environment files or backend secrets are available during the build.
RUN npm run build

FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS runtime
ARG IMAGE_VERSION=local
ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="UniCircle frontend" \
    org.opencontainers.image.source="https://github.com/anindya357/UniCircle" \
    org.opencontainers.image.version=$IMAGE_VERSION \
    org.opencontainers.image.revision=$VCS_REF
# Apply the available Debian security fix explicitly; fail rather than silently
# installing another version if the pinned patch is unavailable.
RUN apt-get update \
    && apt-get install -y --no-install-recommends perl-base=5.36.0-7+deb12u4 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Image optimization can write its cache; application code remains root-owned.
RUN mkdir -p .next/cache && chown -R node:node .next/cache \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v1.22.22 \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/', {signal: AbortSignal.timeout(3000)}).then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1));"]
CMD ["node", "server.js"]
