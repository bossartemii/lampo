FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-dejavu-core \
    fonts-liberation2 \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p /app/lampo-out

ENV PORT=3333
ENV LAMPO_OUT=/app/lampo-out
EXPOSE 3333

CMD ["node", "mcp/server.js", "--http", "3333"]
