FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
RUN npm install --workspaces=false --production=false --no-audit --no-fund
COPY packages/backend ./packages/backend
WORKDIR /app/packages/backend
RUN npm install --production=false --no-audit --no-fund
RUN npx prisma generate
RUN npm run build || true

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app /app
WORKDIR /app/packages/backend
ENV NODE_ENV=production
EXPOSE 3002
CMD sh -c "npx prisma db push --accept-data-loss && npx tsx src/index.ts"
