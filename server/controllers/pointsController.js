import sql from "../configs/db.js";
import crypto from "crypto";
import { rechargePoints, getAccountInfo } from "../services/pointsService.js";
import { checkAndGrantBonus } from "../services/membershipService.js";
import logger from "../configs/logger.js";

// ─────────────────────────────────────────────
// GET /api/points/balance
// ─────────────────────────────────────────────
export const getBalance = async (req, res) => {
  try {
    const { userId } = req.auth;

    // 确保账户存在
    await sql`
      INSERT INTO user_point_accounts (user_id, balance_points, held_points)
      VALUES (${userId}, 0, 0)
      ON CONFLICT (user_id) DO NOTHING
    `;

    // 补发会员月赠（请求时触发）
    await checkAndGrantBonus(userId);

    const account = await getAccountInfo(userId);

    res.json({
      success: true,
      data: {
        balance_points:        account.balance_points,
        held_points:           account.held_points,
        available_points:      Number(account.available_points),
        membership_tier:       account.membership_tier,
        monthly_bonus_points:  account.monthly_bonus_points,
        bonus_cycle_anchor:    account.bonus_cycle_anchor,
        last_bonus_granted_at: account.last_bonus_granted_at,
        next_bonus_at:         account.next_bonus_at,
      },
    });
  } catch (err) {
    logger.error("getBalance.error", { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/points/packages
// ─────────────────────────────────────────────
export const getPackages = async (req, res) => {
  try {
    const packages = await sql`
      SELECT id, package_key, package_name, price_cents, points, bonus_points
      FROM point_packages
      WHERE is_active = true
      ORDER BY price_cents ASC
    `;
    res.json({ success: true, data: packages });
  } catch (err) {
    logger.error("getPackages.error", { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/points/orders
// ─────────────────────────────────────────────
export const createOrder = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { package_key } = req.body;
    const clientRequestId = req.headers["x-idempotency-key"];

    if (!package_key) {
      return res.status(400).json({ success: false, message: "package_key is required" });
    }

    // 幂等检查：必须同时匹配 user_id，防止跨用户串读
    if (clientRequestId) {
      const [existing] = await sql`
        SELECT order_no, amount_cents, points, bonus_points, total_points, status, payment_method
        FROM point_orders
        WHERE client_request_id = ${clientRequestId}
          AND user_id = ${userId}
      `;
      if (existing) {
        return res.json({ success: true, data: existing });
      }
    }

    const [pkg] = await sql`
      SELECT * FROM point_packages WHERE package_key = ${package_key} AND is_active = true
    `;

    if (!pkg) {
      return res.status(400).json({ success: false, message: "Invalid or inactive package" });
    }

    const orderNo = `PO${new Date().toISOString().slice(0, 10).replace(/-/g, "")}${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const totalPoints = pkg.points + pkg.bonus_points;

    const [order] = await sql`
      INSERT INTO point_orders
        (user_id, order_no, package_key, package_name, amount_cents,
         points, bonus_points, total_points, status, payment_method, client_request_id)
      VALUES
        (${userId}, ${orderNo}, ${pkg.package_key}, ${pkg.package_name}, ${pkg.price_cents},
         ${pkg.points}, ${pkg.bonus_points}, ${totalPoints}, 'pending', 'mock', ${clientRequestId || null})
      RETURNING order_no, package_key, amount_cents, points, bonus_points, total_points, status, payment_method
    `;

    logger.info("createOrder", { userId, orderNo, totalPoints });

    res.json({ success: true, data: order });
  } catch (err) {
    logger.error("createOrder.error", { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/points/orders/:orderNo/confirm
// ─────────────────────────────────────────────
export const confirmOrder = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { orderNo } = req.params;
    const confirmRequestId = req.headers["x-idempotency-key"];

    // 幂等检查：必须同时匹配 user_id，防止跨用户串读
    if (confirmRequestId) {
      const [existing] = await sql`
        SELECT order_no, status, total_points FROM point_orders
        WHERE confirm_request_id = ${confirmRequestId}
          AND user_id = ${userId}
      `;
      if (existing && existing.status === "paid") {
        const account = await getAccountInfo(userId);
        return res.json({
          success: true,
          data: {
            order_no: existing.order_no,
            status: existing.status,
            granted_points: existing.total_points,
            balance_points: account?.balance_points ?? 0,
            held_points: account?.held_points ?? 0,
            available_points: Number(account?.available_points ?? 0),
          },
        });
      }
    }

    // Bug 8 修复：在事务内用 FOR UPDATE 锁订单行，防止并发双倍积分
    const result = await sql.begin(async (tx) => {
      const [order] = await tx`
        SELECT * FROM point_orders
        WHERE order_no = ${orderNo} AND user_id = ${userId}
        FOR UPDATE
      `;

      if (!order) return { notFound: true };

      if (order.status === "paid") return { alreadyPaid: true, order };

      if (order.status !== "pending") return { badStatus: order.status };

      // 发放积分（rechargePoints 内部也有幂等门卫）
      const idempotencyKey = `recharge:order:${orderNo}`;
      await rechargePoints({
        userId,
        amount: order.total_points,
        sourceType: "order",
        sourceId: String(order.id),
        idempotencyKey,
        note: `充值 ${order.package_name}`,
        tx,
      });

      await tx`
        UPDATE point_orders
        SET status = 'paid', paid_at = NOW(), confirmed_at = NOW(),
            confirm_request_id = ${confirmRequestId || null}
        WHERE order_no = ${orderNo}
      `;

      return { ok: true, order };
    });

    if (result.notFound) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (result.badStatus) {
      return res.status(400).json({ success: false, message: `Order status is ${result.badStatus}, cannot confirm` });
    }

    const account = await getAccountInfo(userId);
    const grantedPoints = result.order.total_points;

    if (result.alreadyPaid) {
      return res.json({
        success: true,
        data: {
          order_no: result.order.order_no,
          status: "paid",
          granted_points: grantedPoints,
          balance_points: account?.balance_points ?? 0,
          held_points: account?.held_points ?? 0,
          available_points: Number(account?.available_points ?? 0),
        },
      });
    }

    logger.info("confirmOrder.success", { userId, orderNo, grantedPoints });

    res.json({
      success: true,
      data: {
        order_no: orderNo,
        status: "paid",
        granted_points: grantedPoints,
        balance_points: account?.balance_points ?? 0,
        held_points: account?.held_points ?? 0,
        available_points: Number(account?.available_points ?? 0),
      },
    });
  } catch (err) {
    logger.error("confirmOrder.error", { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/points/ledger
// ─────────────────────────────────────────────
export const getLedger = async (req, res) => {
  try {
    const { userId } = req.auth;
    const page      = Math.max(1, parseInt(req.query.page      || "1", 10));
    const page_size = Math.min(50, Math.max(1, parseInt(req.query.page_size || "20", 10)));
    const entry_type = req.query.entry_type || null;
    const offset = (page - 1) * page_size;

    const ledger = await sql`
      SELECT id, entry_type, source_type, source_id, change_points,
             held_points_change, balance_after, held_after, note, created_at
      FROM point_ledger
      WHERE user_id = ${userId}
        AND (${entry_type}::text IS NULL OR entry_type = ${entry_type})
      ORDER BY created_at DESC
      LIMIT ${page_size} OFFSET ${offset}
    `;

    res.json({ success: true, data: ledger, page, page_size });
  } catch (err) {
    logger.error("getLedger.error", { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};
