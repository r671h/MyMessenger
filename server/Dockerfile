# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY docker-entrypoint.cjs ./docker-entrypoint.cjs

# Run as the unprivileged "node" user; uploads/ is the local-storage fallback (mount a volume here).
RUN mkdir -p uploads && chown node:node uploads
USER node

EXPOSE 4000

# apply pending migrations, then start the API/socket server
CMD ["node", "docker-entrypoint.cjs"]
