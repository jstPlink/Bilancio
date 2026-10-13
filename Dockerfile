FROM node:24-slim
LABEL org.opencontainers.image.source="https://github.com/jstPlink/MyBank" \
      org.opencontainers.image.description="MyBank: i movimenti di UniCredit e Revolut, il budget e il widget" \
      org.opencontainers.image.licenses="UNLICENSED"
WORKDIR /app
# poppler-utils: pdftotext, per leggere gli estratti conto in PDF
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
# I dati (movimenti, credenziali di Enable Banking, chiave di firma) stanno in /data: fanne il backup.
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4870 MYBANK_DATA=/data
VOLUME /data
EXPOSE 4870
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4870)+'/api/version').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/start.js"]
