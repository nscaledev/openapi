# syntax=docker/dockerfile:1.10

FROM cgr.dev/chainguard/node:latest-dev AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=secret,id=npm_token,env=NODE_AUTH_TOKEN npm ci

FROM cgr.dev/chainguard/node:latest-dev AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM cgr.dev/chainguard/node:latest AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
ENV PORT=3000
CMD ["server.js"]
