FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate && npm run build
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
RUN mkdir -p uploads
EXPOSE 3000
CMD ["sh", "-c", "export DIRECT_URL=${DIRECT_URL:-$DATABASE_URL} && npx prisma migrate deploy && node dist/main.js"]
