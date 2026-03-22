FROM node:18

# Python + yt-dlp
RUN apt-get update && apt-get install -y python3 python3-pip
RUN pip3 install --no-cache-dir yt-dlp

# PATH fix
ENV PATH="/root/.local/bin:${PATH}"

# Debug
RUN which yt-dlp
RUN yt-dlp --version

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["node", "server.js"]