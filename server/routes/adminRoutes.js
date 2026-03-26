/**
 * Admin 路由骨架
 * 生产上线前需要加管理员鉴权中间件（如 Authing 自定义角色 claims 或 API_ADMIN_KEY）
 */
import express from "express";
import sql from "../configs/db.js";
import logger from "../configs/logger.js";
import { rechargePoints } from "../services/pointsService.js";

const adminRouter = express.Router();

// ── Prompt Templates CRUD ──────────────────────
adminRouter.get("/prompt-templates", async (req, res) => {
  const rows = await sql`SELECT * FROM prompt_templates ORDER BY display_order ASC`;
  res.json({ success: true, data: rows });
});

// 公共幂等 header 检查中间件（所有写接口）
const requireIdempotencyKey = (req, res, next) => {
  if (!req.headers["x-idempotency-key"]) {
    return res.status(400).json({ success: false, message: "X-Idempotency-Key header is required" });
  }
  next();
};

adminRouter.post("/prompt-templates", requireIdempotencyKey, async (req, res) => {
  const { scene_key, scene_name, output_type, target_provider, default_model, default_seconds, default_size, system_prompt, display_order } = req.body;
  const [row] = await sql`
    INSERT INTO prompt_templates (scene_key, scene_name, output_type, target_provider, default_model, default_seconds, default_size, system_prompt, display_order)
    VALUES (${scene_key}, ${scene_name}, ${output_type}, ${target_provider}, ${default_model||null}, ${default_seconds||null}, ${default_size||null}, ${system_prompt}, ${display_order||0})
    RETURNING *
  `;
  res.json({ success: true, data: row });
});

adminRouter.put("/prompt-templates/:id", requireIdempotencyKey, async (req, res) => {
  const { id } = req.params;
  const { scene_name, system_prompt, is_active, display_order } = req.body;
  const [row] = await sql`
    UPDATE prompt_templates
    SET scene_name=${scene_name}, system_prompt=${system_prompt},
        is_active=${is_active}, display_order=${display_order}, updated_at=NOW()
    WHERE id=${id} RETURNING *
  `;
  res.json({ success: true, data: row });
});

adminRouter.delete("/prompt-templates/:id", requireIdempotencyKey, async (req, res) => {
  await sql`UPDATE prompt_templates SET is_active=false WHERE id=${req.params.id}`;
  res.json({ success: true });
});

// ── Generation Charge Rules CRUD ───────────────
adminRouter.get("/generation-charge-rules", async (req, res) => {
  const rows = await sql`SELECT * FROM generation_charge_rules ORDER BY priority ASC`;
  res.json({ success: true, data: rows });
});

adminRouter.post("/generation-charge-rules", requireIdempotencyKey, async (req, res) => {
  const { output_type, provider, scene_key, model, seconds, size, points_cost, priority } = req.body;
  const [row] = await sql`
    INSERT INTO generation_charge_rules (output_type, provider, scene_key, model, seconds, size, points_cost, priority)
    VALUES (${output_type}, ${provider}, ${scene_key||null}, ${model||null}, ${seconds||null}, ${size||null}, ${points_cost}, ${priority||100})
    RETURNING *
  `;
  res.json({ success: true, data: row });
});

adminRouter.put("/generation-charge-rules/:id", requireIdempotencyKey, async (req, res) => {
  const { points_cost, priority, is_active } = req.body;
  const [row] = await sql`
    UPDATE generation_charge_rules
    SET points_cost=${points_cost}, priority=${priority}, is_active=${is_active}, updated_at=NOW()
    WHERE id=${req.params.id} RETURNING *
  `;
  res.json({ success: true, data: row });
});

adminRouter.delete("/generation-charge-rules/:id", requireIdempotencyKey, async (req, res) => {
  await sql`UPDATE generation_charge_rules SET is_active=false WHERE id=${req.params.id}`;
  res.json({ success: true });
});

// ── Orders ─────────────────────────────────────
adminRouter.get("/orders", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const page_size = Math.min(100, parseInt(req.query.page_size || "20", 10));
  const offset = (page - 1) * page_size;
  const rows = await sql`
    SELECT * FROM point_orders ORDER BY created_at DESC LIMIT ${page_size} OFFSET ${offset}
  `;
  res.json({ success: true, data: rows, page, page_size });
});

// ── Manual Points Adjustment ───────────────────
adminRouter.post("/users/:userId/points/adjust", async (req, res) => {
  const { userId } = req.params;
  const { amount, note } = req.body;
  const idempotencyKey = req.headers["x-idempotency-key"];

  if (!idempotencyKey) {
    return res.status(400).json({ success: false, message: "X-Idempotency-Key required" });
  }
  if (!amount || amount === 0) {
    return res.status(400).json({ success: false, message: "amount must be non-zero" });
  }

  try {
    // entry_type 对齐 spec: manual_adjustment
    await rechargePoints({
      userId,
      amount,
      sourceType: "admin",
      sourceId: idempotencyKey,
      idempotencyKey: `admin:adjust:${idempotencyKey}`,
      note: note || `管理员手工调整 ${amount > 0 ? "+" : ""}${amount}`,
      entryType: "manual_adjustment",
    });
    res.json({ success: true });
  } catch (err) {
    logger.error("admin.adjust.error", { userId, amount, error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
});

export default adminRouter;
