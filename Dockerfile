FROM node:22-bookworm-slim AS builder

WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-bookworm-slim

# Install Docker CLI, Compose plugin, OpenSSH client, git, curl, procps, iproute2 so agy can manage the server
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    git \
    openssh-client \
    procps \
    iproute2 \
    jq \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

ENV NODE_ENV=production
ENV PORT=3001
ENV AGY_BIN=/usr/local/bin/agy
ENV AGY_DATA_DIR=/root/.gemini/antigravity-cli

EXPOSE 3001

CMD ["npm", "start"]
