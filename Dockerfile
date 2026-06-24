# syntax=docker/dockerfile:1.4

# SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
# SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
#
# SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

FROM --platform=$BUILDPLATFORM docker.io/library/node:24-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY . /app
WORKDIR /app

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build
RUN gzip -k /app/dist/**/*
RUN ln -s /tmp/index.runtime.html dist/

FROM ghcr.io/nginx/nginx-unprivileged:1.31.2-alpine-slim

COPY --from=builder /app/dist /dist
COPY docker/default.conf /etc/nginx/conf.d/default.conf
COPY docker/security_headers.conf /etc/nginx/security_headers.conf
COPY docker/http_customisations.conf /etc/nginx/conf.d/http_customisations.conf
COPY docker/configure-listen.sh /docker-entrypoint.d/05-configure-listen.sh
COPY docker/replace-config.sh /docker-entrypoint.d/50-replace-config.sh

EXPOSE 8080
