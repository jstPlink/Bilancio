FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
ENV HOST=0.0.0.0 PORT=4870 BILANCIO_DATA=/data
VOLUME /data
EXPOSE 4870
CMD ["node", "src/server.js"]
