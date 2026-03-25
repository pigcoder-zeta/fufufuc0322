/**
 * 积分事务服务
 *
 * 幂等保证策略（修复 Bug 1）：
 *   事务内先查 point_ledger 是否已存在该 idempotency_key，
 *   存在则直接返回（账户不再变动）；
 *   不存在则先写流水、再改账户，保证"账本一条 ↔ 账户改一次"。
 *
 * 账本语义：
 *   reserve : change_points = 0,  held_points_change = +N  （预占）
 *   charge  : change_points = -N, held_points_change = -N  （结算扣减）
 *   release : change_points = 0,  held_points_change = -N  （返还预占）
 *   recharge: change_points = +N, held_points_change = 0   （充值 / 赠送）
 */
import sql from "../configs/db.js";
import logger from "../configs/logger.js";

/**
 * 确保用户积分账户存在并加行锁（必须在事务中调用）。
 */
export const ensureAccountTx = async (tx, userId) => {
  // UPSERT 保证账户存在
  await tx`
    INSERT INTO user_point_accounts (user_id, balance_points, held_points)
    VALUES (${userId}, 0, 0)
    ON CONFLICT (user_id) DO NOTHING
  `;

  const [account] = await tx`
    SELECT * FROM user_point_accounts
    WHERE user_id = ${userId}
    FOR UPDATE
  `;

  return account;
};

// ─── 幂等门卫：在事务锁内检查 idempotency_key ───────────────────────
const checkLedgerIdempotency = async (tx, idempotencyKey) => {
  const [existing] = await tx`
    SELECT id, balance_after, held_after, change_points, held_points_change
    FROM point_ledger
    WHERE idempotency_key = ${idempotencyKey}
  `;
  return existing || null;
};

// ─────────────────────────────────────────────
// reservePoints — 预占积分
// ─────────────────────────────────────────────
export const reservePoints = async ({ userId, amount, creationId, idempotencyKey, note }) => {
  return sql.begin(async (tx) => {
    // 1. 锁定账户
    const account = await ensureAccountTx(tx, userId);

    // 2. 幂等检查（在锁内）— 已存在直接返回，账户不动
    const existing = await checkLedgerIdempotency(tx, idempotencyKey);
    if (existing) {
      logger.info("points.reserve.idempotent", { userId, idempotencyKey });
      return { success: true, ledger: existing };
    }

    // 3. 校验可用积分
    const available = account.balance_points - account.held_points;
    if (available < amount) {
      throw Object.assign(new Error("Insufficient points"), {
        code: "INSUFFICIENT_POINTS",
        available_points: available,
        required_points: amount,
      });
    }

    const newHeld = account.held_points + amount;

    // 4. 先写流水（idempotency_key 唯一，若并发重入此处会报唯一冲突）
    const [ledger] = await tx`
      INSERT INTO point_ledger
        (user_id, entry_type, source_type, source_id, idempotency_key,
         change_points, held_points_change, balance_after, held_after, note)
      VALUES
        (${userId}, 'reserve', 'creation', ${String(creationId)}, ${idempotencyKey},
         0, ${amount}, ${account.balance_points}, ${newHeld}, ${note || null})
      RETURNING *
    `;

    // 5. 再改账户（流水写成功才到这里）
    await tx`
      UPDATE user_point_accounts
      SET held_points = ${newHeld}, version = version + 1, updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    logger.info("points.reserve", { userId, amount, creationId, ledgerId: ledger.id });
    return { success: true, ledger };
  });
};

// ─────────────────────────────────────────────
// chargePoints — 结算扣减
// ─────────────────────────────────────────────
export const chargePoints = async ({ userId, amount, creationId, idempotencyKey, note }) => {
  return sql.begin(async (tx) => {
    const account = await ensureAccountTx(tx, userId);

    const existing = await checkLedgerIdempotency(tx, idempotencyKey);
    if (existing) {
      logger.info("points.charge.idempotent", { userId, idempotencyKey });
      return { success: true, ledger: existing };
    }

    const newBalance = account.balance_points - amount;
    const newHeld    = account.held_points    - amount;

    if (newBalance < 0 || newHeld < 0) {
      throw new Error("Account balance inconsistency on charge");
    }

    const [ledger] = await tx`
      INSERT INTO point_ledger
        (user_id, entry_type, source_type, source_id, idempotency_key,
         change_points, held_points_change, balance_after, held_after, note)
      VALUES
        (${userId}, 'charge', 'creation', ${String(creationId)}, ${idempotencyKey},
         ${-amount}, ${-amount}, ${newBalance}, ${newHeld}, ${note || null})
      RETURNING *
    `;

    await tx`
      UPDATE user_point_accounts
      SET balance_points = ${newBalance}, held_points = ${newHeld},
          version = version + 1, updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    logger.info("points.charge", { userId, amount, creationId, ledgerId: ledger.id });
    return { success: true, ledger };
  });
};

// ─────────────────────────────────────────────
// releasePoints — 返还预占
// ─────────────────────────────────────────────
export const releasePoints = async ({ userId, amount, creationId, idempotencyKey, note }) => {
  return sql.begin(async (tx) => {
    const account = await ensureAccountTx(tx, userId);

    const existing = await checkLedgerIdempotency(tx, idempotencyKey);
    if (existing) {
      logger.info("points.release.idempotent", { userId, idempotencyKey });
      return { success: true, ledger: existing };
    }

    // amount = 0 时不写流水（无预占可释放），直接幂等返回
    if (amount <= 0) {
      logger.info("points.release.skip", { userId, reason: "amount=0" });
      return { success: true, ledger: null };
    }

    const newHeld = Math.max(0, account.held_points - amount);

    const [ledger] = await tx`
      INSERT INTO point_ledger
        (user_id, entry_type, source_type, source_id, idempotency_key,
         change_points, held_points_change, balance_after, held_after, note)
      VALUES
        (${userId}, 'release', 'creation', ${String(creationId)}, ${idempotencyKey},
         0, ${-amount}, ${account.balance_points}, ${newHeld}, ${note || null})
      RETURNING *
    `;

    await tx`
      UPDATE user_point_accounts
      SET held_points = ${newHeld}, version = version + 1, updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    logger.info("points.release", { userId, amount, creationId, ledgerId: ledger.id });
    return { success: true, ledger };
  });
};

// ─────────────────────────────────────────────
// rechargePoints — 充值发放
// ─────────────────────────────────────────────
export const rechargePoints = async ({
  userId, amount, sourceType, sourceId, idempotencyKey, note, tx: externalTx,
}) => {
  const run = async (tx) => {
    const account = await ensureAccountTx(tx, userId);

    const existing = await checkLedgerIdempotency(tx, idempotencyKey);
    if (existing) {
      logger.info("points.recharge.idempotent", { userId, idempotencyKey });
      return { success: true, ledger: existing, newBalance: existing.balance_after };
    }

    const newBalance = account.balance_points + amount;

    const [ledger] = await tx`
      INSERT INTO point_ledger
        (user_id, entry_type, source_type, source_id, idempotency_key,
         change_points, held_points_change, balance_after, held_after, note)
      VALUES
        (${userId}, 'recharge', ${sourceType}, ${String(sourceId)}, ${idempotencyKey},
         ${amount}, 0, ${newBalance}, ${account.held_points}, ${note || null})
      RETURNING *
    `;

    await tx`
      UPDATE user_point_accounts
      SET balance_points = ${newBalance}, version = version + 1, updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    logger.info("points.recharge", { userId, amount, sourceId, ledgerId: ledger.id });
    return { success: true, ledger, newBalance };
  };

  return externalTx ? run(externalTx) : sql.begin(run);
};

// ─────────────────────────────────────────────
// resolveCharge — 查询计费规则
// ─────────────────────────────────────────────
export const resolveCharge = async ({ outputType, provider, sceneKey, model, seconds, size }) => {
  const rules = await sql`
    SELECT points_cost FROM generation_charge_rules
    WHERE output_type = ${outputType}
      AND provider    = ${provider}
      AND is_active   = true
      AND (scene_key = ${sceneKey} OR scene_key IS NULL)
      AND (model     = ${model}    OR model     IS NULL)
      AND (seconds   = ${seconds}  OR seconds   IS NULL)
      AND (size      = ${size}     OR size      IS NULL)
    ORDER BY priority ASC
    LIMIT 1
  `;

  if (rules.length === 0) {
    throw new Error(`No active charge rule found for ${outputType}/${provider}/${sceneKey}`);
  }

  return rules[0].points_cost;
};

// ─────────────────────────────────────────────
// getAccountInfo — 只读展示
// ─────────────────────────────────────────────
export const getAccountInfo = async (userId) => {
  const [account] = await sql`
    SELECT balance_points, held_points,
           (balance_points - held_points) AS available_points,
           membership_tier, monthly_bonus_points,
           bonus_cycle_anchor, last_bonus_granted_at, next_bonus_at
    FROM user_point_accounts
    WHERE user_id = ${userId}
  `;
  return account || null;
};
