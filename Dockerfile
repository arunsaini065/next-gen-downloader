FROM node:18

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 🔥 stable yt-dlp version (VERY IMPORTANT)
RUN python3 -m pip install --upgrade pip --break-system-packages
RUN pip3 install --no-cache-dir yt-dlp==2024.12.23 --break-system-packages

ENV PATH="/usr/local/bin:/usr/bin:${PATH}"

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["node", "server.js"]