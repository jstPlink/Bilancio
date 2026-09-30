FROM node:24-slim
LABEL org.opencontainers.image.source="https://github.com/jstPlink/Bilancio" \
      org.opencontainers.image.description="Bilancio: buste paga, bollette e conti di casa in ordine" \
      org.opencontainers.image.licenses="UNLICENSED"
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
# node:sqlite è incluso in Node 24: nessun modulo nativo per il database. I dati (database e cache OCR) stanno in /data.
ENV NODE_ENV=production NODE_NO_WARNINGS=1 HOST=0.0.0.0 PORT=4870 BILANCIO_DATA=/data
VOLUME /data
EXPOSE 4870
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4870)+'/api/version').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
