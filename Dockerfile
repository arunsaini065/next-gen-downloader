FROM node:18

RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    firefox-esr

RUN pip3 install --no-cache-dir yt-dlp

ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["node", "server.js"]