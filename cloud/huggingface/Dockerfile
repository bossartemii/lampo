# Lampo Cloud on Hugging Face Spaces (Docker, free CPU). Upload this file and README.md to a new Space.
# It downloads Lampo from GitHub at build time: "Factory rebuild" in the Space settings updates it.
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg fonts-inter fonts-dejavu-core fonts-liberation2 ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

# Spaces run the container as UID 1000: in this image that's the "node" user
USER node
ENV HOME=/home/node
WORKDIR /home/node

ARG LAMPO_REF=main
RUN git clone --depth 1 --branch ${LAMPO_REF} https://github.com/bossartemii/lampo app \
  && cd app && npm ci --omit=dev

WORKDIR /home/node/app
ENV PORT=7860 \
    LAMPO_OUT=/home/node/out \
    LAMPO_KEYS_FILE=/home/node/data/keys.json
EXPOSE 7860
CMD ["node", "mcp/server.js", "--http", "7860"]
