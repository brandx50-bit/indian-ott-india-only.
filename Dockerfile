FROM node:24.19.0-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY src ./src
COPY public ./public
RUN mkdir /app/.cache && chown node:node /app/.cache
USER node
ENV HOST=0.0.0.0 PORT=7000 NODE_ENV=production CACHE_DIR=/app/.cache
EXPOSE 7000
CMD ["node", "src/server.js"]
