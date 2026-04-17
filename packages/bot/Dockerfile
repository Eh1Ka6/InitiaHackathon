FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY packages/bot/package*.json ./packages/bot/
RUN npm install --workspaces=false --production=false --no-audit --no-fund
COPY packages/bot ./packages/bot
WORKDIR /app/packages/bot
RUN npm install --production=false --no-audit --no-fund
ENV NODE_ENV=production
CMD ["npx", "tsx", "src/index.ts"]
