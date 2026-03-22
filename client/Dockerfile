FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_AUTHING_APP_ID
ARG VITE_AUTHING_DOMAIN
ARG VITE_AUTHING_REDIRECT_URI
ARG VITE_AUTHING_LOGOUT_URI
ARG VITE_BASE_URL

ENV VITE_AUTHING_APP_ID=$VITE_AUTHING_APP_ID
ENV VITE_AUTHING_DOMAIN=$VITE_AUTHING_DOMAIN
ENV VITE_AUTHING_REDIRECT_URI=$VITE_AUTHING_REDIRECT_URI
ENV VITE_AUTHING_LOGOUT_URI=$VITE_AUTHING_LOGOUT_URI
ENV VITE_BASE_URL=$VITE_BASE_URL

RUN npm run build

# ── 生产：Nginx 托管静态资源 ──────────────────────
FROM nginx:1.27-alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
