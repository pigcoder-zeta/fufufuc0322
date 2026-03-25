import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import cron from "node-cron";
import "dotenv/config";

import aiRouter from "./routes/aiRoutes.js";
import userRouter from "./routes/userRoutes.js";
import pointsRouter from "./routes/pointsRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import { requireAuth } from "./middlewares/auth.js";
import { requireAdmin } from "./middlewares/requireAdmin.js";
import sql from "./configs/db.js";
import logger from "./configs/logger.js";
import { deleteObjects } from "./configs/oss.js";
import { compensationScan } from "./services/membershipService.js";

const app = express();

// ── 安全头 ───────────────────────────────────────
app.use(helmet());

// ── CORS 白名单 ──────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",").map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin && process.env.NODE_ENV !== "production") return callback(null, true);
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ── HTTP 访问日志 ─────────────────────────────────
app.use(morgan("combined", {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

app.use(express.json({ limit: "2mb" }));

// ── 全局限流 ─────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, max: 200,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, code: "RATE_LIMITED", message: "Too many requests." },
}));

// ── 健康检查 ─────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "ok", service: "QuickAI-MVP API" }));
app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

// ── 业务路由（生成接口限流已移至 aiRoutes.js 路由层）────────────────
app.use("/api/ai", requireAuth(), aiRouter);
app.use("/api/user", requireAuth(), userRouter);
app.use("/api/points", requireAuth(), pointsRouter);
app.use("/api/admin", requireAuth(), requireAdmin(), adminRouter);

// ── 全局错误处理 ─────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error("unhandledError", { method: req.method, path: req.path, message: err.message });
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
});

// ═══════════════════════════════════════════════
// 定时任务
// ═══════════════════════════════════════════════

// 1. 30 天过期记录清理（每天凌晨 3:00）
cron.schedule("0 3 * * *", async () => {
  logger.info("cron.cleanup.start");
  try {
    const expired = await sql`
      SELECT id, content_object_key, thumbnail_object_key, type
      FROM creations WHERE expires_at < NOW() LIMIT 200
    `;

    let deleted = 0;
    for (const row of expired) {
      try {
        const keysToDelete = [row.content_object_key, row.thumbnail_object_key].filter(Boolean);
        if (keysToDelete.length > 0) await deleteObjects(keysToDelete);
        await sql`DELETE FROM creations WHERE id = ${row.id}`;
        deleted++;
      } catch (itemErr) {
        logger.error("cron.cleanup.item.error", { id: row.id, error: itemErr.message });
      }
    }

    logger.info("cron.cleanup.done", { scanned: expired.length, deleted });
  } catch (err) {
    logger.error("cron.cleanup.error", { error: err.message });
  }
});

// 2. 视频任务超时补偿（每 30 分钟）
cron.schedule("*/30 * * * *", async () => {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const stuckTasks = await sql`
      SELECT id, user_id, points_reserved, scene_name
      FROM creations
      WHERE type = 'video' AND status IN ('pending', 'running')
        AND created_at < ${twoHoursAgo}
    `;

    for (const task of stuckTasks) {
      try {
        const { releasePoints } = await import("./services/pointsService.js");
        await releasePoints({
          userId: task.user_id, amount: task.points_reserved, creationId: task.id,
          idempotencyKey: `release:timeout:${task.id}`,
          note: "返还：视频任务超时",
        });
        await sql`
          UPDATE creations
          SET status = 'failed', charge_status = 'released',
              points_reserved = 0, error_message = 'Task timed out after 2 hours'
          WHERE id = ${task.id}
        `;
        logger.info("cron.videoTimeout.released", { creationId: task.id });
      } catch (err) {
        logger.error("cron.videoTimeout.error", { id: task.id, error: err.message });
      }
    }
  } catch (err) {
    logger.error("cron.videoTimeout.scan.error", { error: err.message });
  }
});

// 3. 会员月赠补偿扫描（每天凌晨 1:00）
cron.schedule("0 1 * * *", async () => {
  logger.info("cron.membershipBonus.start");
  await compensationScan();
});

// ── 启动 ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info("QuickAI-MVP server started", {
    port: PORT, env: process.env.NODE_ENV || "development",
  });
});
