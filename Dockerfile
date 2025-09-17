# syntax=docker/dockerfile:1.4

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

FROM ghcr.io/nginx/nginx-unprivileged:1.29.1-alpine

COPY --from=builder /app/dist /dist
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/replace-config.sh /docker-entrypoint.d/replace-config.sh

EXPOSE 8080
