# syntax=docker/dockerfile:1.7
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate
WORKDIR /app

FROM ghcr.io/astral-sh/uv:0.8.13 AS uv-bin

FROM alpine:3.22 AS foxit-source
RUN apk add --no-cache git \
    && git clone https://github.com/foxitsoftware/foxit-pdf-api-mcp-server.git /opt/foxit-pdf-api-mcp-server \
    && cd /opt/foxit-pdf-api-mcp-server \
    && git checkout db16f9d0f18b878a07f41621e708dbb78bc13e4c \
    && rm -rf .git

FROM base AS dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates curl python3 python3-venv qpdf tini \
    && rm -rf /var/lib/apt/lists/*
COPY --from=uv-bin /uv /uvx /usr/local/bin/
COPY --from=foxit-source /opt/foxit-pdf-api-mcp-server /opt/foxit-pdf-api-mcp-server
ENV UV_DEFAULT_INDEX=https://pypi.org/simple
RUN cd /opt/foxit-pdf-api-mcp-server/python/foxit-pdf-api-mcp-server \
    && sed -i \
      -e 's#https://pypi.tuna.tsinghua.edu.cn/simple#https://pypi.org/simple#g' \
      -e 's#https://pypi.tuna.tsinghua.edu.cn/packages/#https://files.pythonhosted.org/packages/#g' \
      uv.lock \
    && uv sync --frozen --no-dev
ENV FOXIT_MCP_COMMAND=/usr/local/bin/uv \
    FOXIT_MCP_CWD=/opt/foxit-pdf-api-mcp-server/python/foxit-pdf-api-mcp-server \
    FOXIT_MCP_MODULE_ROOT=/opt/foxit-pdf-api-mcp-server
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/tsconfig.json ./tsconfig.json
RUN mkdir -p /var/lib/signlatch/artifacts \
    && chown -R node:node /var/lib/signlatch
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["pnpm", "start"]
