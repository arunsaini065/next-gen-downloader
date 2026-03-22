FROM node:18

RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    firefox-esr

RUN pip3 install --no-cache-dir yt-dlp

# 🔥 verify
RUN /usr/local/bin/yt-dlp --version

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=8000
ENV YTDLP_PATH=/usr/local/bin/yt-dlp

EXPOSE 8000

CMD ["node", "server.js"]