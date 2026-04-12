FROM node:18

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp with curl_cffi so browser impersonation targets are available
RUN pip3 install --no-cache-dir -U "yt-dlp[default,curl-cffi]" --break-system-packages

ENV PATH="/usr/local/bin:/usr/bin:${PATH}"

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["node", "server.js"]
