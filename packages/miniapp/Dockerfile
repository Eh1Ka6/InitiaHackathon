FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/miniapp/package*.json ./packages/miniapp/
RUN npm install --workspaces=false --production=false --no-audit --no-fund
COPY packages/miniapp ./packages/miniapp
WORKDIR /app/packages/miniapp
RUN npm install --production=false --no-audit --no-fund
ARG VITE_API_URL
ARG VITE_CHAIN_ID
ARG VITE_WAGER_CONTRACT
ARG VITE_ESCROW_CONTRACT
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/packages/miniapp/dist /usr/share/nginx/html
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location / {\n    try_files $uri /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
