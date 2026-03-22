FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# 创建日志目录
RUN mkdir -p /app/logs /app/tmp

EXPOSE 5000

CMD ["node", "server.js"]
