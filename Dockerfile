# syntax=docker/dockerfile:1
# MSV: imagem de produção (Next.js `output: 'standalone'`). O MVP roda na Vercel; este arquivo
# existe para a migração para a infra Manserv. Não é usado no ambiente de desenvolvimento.
#
# Variáveis de ambiente (DATABASE_URL, BETTER_AUTH_SECRET, ...) entram em tempo de execução
# (ver .env.example). Migrations NÃO rodam aqui: `prisma migrate deploy` roda no pipeline.

FROM node:22-alpine AS base
WORKDIR /app

# 1) Dependências. Sem scripts: o `postinstall` (prisma generate) precisa do schema, que ainda não foi copiado.
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# 2) Build: gera o Prisma Client, o service worker (npm run sw) e o bundle standalone.
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# 3) Runtime: só o necessário, sem root.
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
