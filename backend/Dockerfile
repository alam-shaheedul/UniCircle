# Both stages use the same immutable Python 3.12 / Debian Bookworm base.
FROM python:3.12-slim-bookworm@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258 AS dependencies

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build
COPY requirements.lock ./
RUN python -m venv /opt/venv \
    && /opt/venv/bin/python -m pip install --require-hashes --only-binary=:all: -r requirements.lock \
    && /opt/venv/bin/python -m pip check

FROM python:3.12-slim-bookworm@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258 AS runtime

ARG IMAGE_VERSION=local
ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="UniCircle backend" \
    org.opencontainers.image.source="https://github.com/anindya357/UniCircle" \
    org.opencontainers.image.version=$IMAGE_VERSION \
    org.opencontainers.image.revision=$VCS_REF

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_ENV=production

RUN groupadd --gid 10001 unicircle \
    && useradd --uid 10001 --gid unicircle --no-create-home --home-dir /tmp unicircle

WORKDIR /app
COPY --from=dependencies /opt/venv /opt/venv
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./

# Keep code root-owned and read-only to the service account.
USER 10001:10001
EXPOSE 8000

# Liveness only: database/model/SMTP readiness is a separate deployment concern.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import json, urllib.request; r = urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3); d = json.load(r); assert r.status == 200 and d['data']['status'] == 'ok' and d['data']['service'] == 'unicircle-api'"]

# Wait for an authenticated database probe, then exec Uvicorn for signal forwarding.
# Reviewed migrations still run as an explicit release step.
CMD ["python", "-m", "app.db.wait", "--exec-api"]
