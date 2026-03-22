FROM node:18

# 🔥 Install python + dependencies properly
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    curl \
    ca-certificates \
    firefox-esr

# 🔥 Upgrade pip (IMPORTANT FIX)
RUN python3 -m pip install --upgrade pip

# 🔥 Install yt-dlp
RUN pip3 install yt-dlp

# 🔥 verify
RUN /usr/local/bin/yt-dlp --version

# ENV
ENV PATH="/usr/local/bin:${PATH}"
ENV YTDLP_PATH=/usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["node", "server.js"]