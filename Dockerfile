FROM node:18

# ✅ Python + yt-dlp + ffmpeg + browser deps
RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    firefox-esr

# ✅ yt-dlp install (global)
RUN pip3 install --no-cache-dir yt-dlp

# ✅ IMPORTANT: ensure binary accessible
RUN ln -s /usr/local/bin/yt-dlp /usr/bin/yt-dlp

# Debug (optional)
RUN yt-dlp --version

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["node", "server.js"]