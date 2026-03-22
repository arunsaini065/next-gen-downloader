FROM node:18

RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    ffmpeg \
    firefox-esr

RUN pip3 install --no-cache-dir yt-dlp

# 🔥 IMPORTANT
ENV PATH="/usr/local/bin:${PATH}"
ENV YTDLP_PATH=/usr/local/bin/yt-dlp

RUN yt-dlp --version

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["node", "server.js"]