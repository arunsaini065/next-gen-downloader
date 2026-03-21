FROM node:18

# Python install (yt-dlp ke liye)
RUN apt-get update && apt-get install -y python3 python3-pip

# yt-dlp install
RUN pip3 install yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]