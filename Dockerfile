FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-inter \
    fonts-dejavu-core \
    fonts-liberation2 \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p /app/lampo-out /data

ENV PORT=3333
ENV LAMPO_OUT=/app/lampo-out
# client keys and credits live on a volume, so they survive redeploys (mount one at /data)
ENV LAMPO_KEYS_FILE=/data/keys.json
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3333)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "mcp/server.js", "--http", "3333"]
