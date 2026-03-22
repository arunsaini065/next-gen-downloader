FROM node:18

# 🔥 install dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    firefox-esr

# 🔥 FIX: install yt-dlp without upgrade pip
RUN pip3 install --no-cache-dir yt-dlp --break-system-packages

# 🔥 verify
RUN /usr/bin/yt-dlp --version || true
RUN /usr/local/bin/yt-dlp --version || true

# 🔥 PATH fix
ENV PATH="/usr/local/bin:/usr/bin:${PATH}"
ENV YTDLP_PATH=yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["node", "server.js"]