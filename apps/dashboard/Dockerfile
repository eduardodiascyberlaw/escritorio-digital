FROM node:20-alpine AS builder
RUN apk add --no-cache --virtual .build-deps python3 make g++
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json server.ts types.ts auth.ts users.ts ./
COPY routes/ ./routes/
COPY scripts/ ./scripts/
RUN npx tsc

FROM node:20-alpine
RUN apk add --no-cache --virtual .build-deps python3 make g++
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && apk del .build-deps 2>/dev/null; rm -rf /var/cache/apk/*
COPY --from=builder /app/dist ./dist
COPY public/ ./public/
EXPOSE 3200
CMD ["node", "dist/server.js"]
