# QuickAI-MVP 生产部署说明

## 前置条件

- 服务器已安装 Docker ≥ 24 + Docker Compose v2
- 已注册 Clerk、Neon PostgreSQL、Cloudinary 账号
- 已申请图片 Provider（Nano Banana 2）和 OpenAI API Key

---

## 第一步：运行数据库迁移

在 Neon 控制台的 SQL Editor 中，粘贴并执行：

```
server/migrations/001_full_schema.sql
```

脚本已做幂等处理，可重复执行。

---

## 第二步：填写环境变量

### 后端
```bash
cp server/.env.example server/.env
# 编辑 server/.env，填入所有真实值
```

### 根目录（前端构建参数）
```bash
cp .env.example .env
# 至少填入：
# VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
```

---

## 第三步：构建并启动

```bash
docker compose up -d --build
```

### 查看日志
```bash
docker compose logs -f api    # 后端日志
docker compose logs -f web    # Nginx 日志
```

### 持久化日志位置
- 后端日志挂载在 Docker volume `api_logs`，对应容器内 `/app/logs`

---

## 第四步：HTTPS（推荐）

在宿主机用 Nginx + Let's Encrypt / Certbot 做 HTTPS 入口，
将 443 请求反向代理到本机 80 端口（docker compose web 容器）。

示例宿主机 Nginx 配置片段：
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

配置好 HTTPS 后，更新：
- `server/.env` → `ALLOWED_ORIGINS=https://your-domain.com`
- `.env`        → `VITE_CLERK_PUBLISHABLE_KEY=pk_live_...`（用正式 publishable key）

---

## 常用命令

```bash
# 停止
docker compose down

# 重启后端（不重建前端）
docker compose up -d --build api

# 查看运行状态
docker compose ps

# 进入后端容器排查
docker exec -it quickai_api sh
```

---

## 关键检查点

| 检查项 | 验证方式 |
|---|---|
| 积分预占-结算 | 生成图片后查看 `/api/points/balance`，held_points 应归零 |
| 订单幂等 | 同一 X-Idempotency-Key 确认两次，积分只发一次 |
| 视频失败返还 | 提交失败任务后查看流水，有 release 记录 |
| 过期下载拦截 | 修改 DB expires_at 到过去，下载返回 410 |
| Cloudinary 清理 | cron 运行后检查 Cloudinary 资源是否同步删除 |
| 会员月赠 | 手动触发 `/api/points/balance` 时检查是否补发 |
