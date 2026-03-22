/**
 * 积分事务服务
 * 所有积分变更都在此处完成，保证原子性、幂等性和审计一致性。
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
 * 确保用户积分账户存在，不存在则创建。
 * 返回账户行（已加行级锁，必须在事务中调用）。
 */
export const ensureAccountTx = async (tx, userId) => {
  let [account] = await tx`
    SELECT * FROM user_point_accounts
    WHERE user_id = ${userId}
    FOR UPDATE
  `;

  if (!account) {
    [account] = await tx`
      INSERT INTO user_point_accounts (user_id, balance_points, held_points)
      VALUES (${userId}, 0, 0)
      ON CONFLICT (user_id) DO UPDATE
        SET user_id = EXCLUDED.user_id
      RETURNING *
    `;
    // 再加锁
    [account] = await tx`
      SELECT * FROM user_point_accounts
      WHERE user_id = ${userId}
      FOR UPDATE
    `;
  }

  return account;
};

/**
 * 预占积分（reserve）
 * - 校验 available_points >= amount
 * - held_points += amount
 * - 写入流水
 */
export const reservePoints = async ({
  userId,
  amount,
  creationId,
  idempotencyKey,
  note,
}) => {
  return sql.begin(async (tx) => {
    const account = await ensureAccountTx(tx, userId);

    const available = account.balance_points - account.held_points;
    if (available < amount) {
      throw Object.assign(new Error("Insufficient points"), {
        code: "INSUFFICIENT_POINTS",
        available_points: available,
        required_points: amount,
      });
    }

    const newHeld = account.held_points + amount;

    await tx`
      UPDATE user_point_accounts
      SET held_points = ${newHeld}, version = version + 1, updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    const [ledger] = await tx`
      INSERT INTO point_ledger
        (user_id, entry_type, source_type, source_id, idempotency_key,
         change_points, held_points_change, balance_after, held_after, note)
      VALUES
        (${userId}, 'reserve', 'creation', ${String(creationId)}, ${idempotencyKey},
         0, ${amount}, ${account.balance_points}, ${newHeld}, ${note || null})
      ON CONFLICT (idempotency_key) DO UPDATE
        SET idempotency_key = EXCLUDED.idempotency_key
      RETURNING *
    `;

    logger.info("points.reserve", { userId, amount, creationId, ledgerId: ledger.id });
    return { success: true, ledger };
  });
};

/**
 * 结算扣减（charge）
 * - balance_points -= amount, held_points -= amount
 * - charge_status → charged
 */
export const chargePoints = async ({
  userId,
  amount,
  creationId,
  idempotencyKey,
  note,
}) => {
  return sql.begin(async (tx) => {
    const account = await ensureAccountTx(tx, userId);

    const newBalance = account.balance_points - amount;
    const newHeld = account.held_points - amount;

    if (newBalance < 0 || newHeld < 0) {
      throw new Error("Account balance inconsistency on charge");
    }

    await tx`
      UPDATE user_point_accounts
      SET balance_points = ${newBalance}, held_points = ${newHeld},
          version = version + 1, updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    const [ledger] = await tx`
      INSERT INTO point_ledger
        (user_id, entry_type, source_type, source_id, idempotency_key,
         change_points, held_points_change, balance_after, held_after, note)
      VALUES
        (${userId}, 'charge', 'creation', ${String(creationId)}, ${idempotencyKey},
         ${-amount}, ${-amount}, ${newBalance}, ${newHeld}, ${note || null})
      ON CONFLICT (idempotency_key) DO UPDATE
        SET idempotency_key = EXCLUDED.idempotency_key
      RETURNING *
    `;

    logger.info("points.charge", { userId, amount, creationId, ledgerId: ledger.id });
    return { success: true, ledger };
  });
};

/**
 * 返还预占（release）
 * - held_points -= amount
 * - balance_points 不变
 * - charge_status → released
 */
export const releasePoints = async ({
  userId,
  amount,
  creationId,
  idempotencyKey,
  note,
}) => {
  return sql.begin(async (tx) => {
    const account = await ensureAccountTx(tx, userId);

    const newHeld = Math.max(0, account.held_points - amount);

    await tx`
      UPDATE user_point_accounts
      SET held_points = ${newHeld}, version = version + 1, updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    const [ledger] = await tx`
      INSERT INTO point_ledger
        (user_id, entry_type, source_type, source_id, idempotency_key,
         change_points, held_points_change, balance_after, held_after, note)
      VALUES
        (${userId}, 'release', 'creation', ${String(creationId)}, ${idempotencyKey},
         0, ${-amount}, ${account.balance_points}, ${newHeld}, ${note || null})
      ON CONFLICT (idempotency_key) DO UPDATE
        SET idempotency_key = EXCLUDED.idempotency_key
      RETURNING *
    `;

    logger.info("points.release", { userId, amount, creationId, ledgerId: ledger.id });
    return { success: true, ledger };
  });
};

/**
 * 充值发放（recharge）
 * - balance_points += amount
 * - 写入 recharge 流水
 */
export const rechargePoints = async ({
  userId,
  amount,
  sourceType,
  sourceId,
  idempotencyKey,
  note,
  tx: externalTx,
}) => {
  const run = async (tx) => {
    const account = await ensureAccountTx(tx, userId);
    const newBalance = account.balance_points + amount;

    await tx`
      UPDATE user_point_accounts
      SET balance_points = ${newBalance}, version = version + 1, updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    const [ledger] = await tx`
      INSERT INTO point_ledger
        (user_id, entry_type, source_type, source_id, idempotency_key,
         change_points, held_points_change, balance_after, held_after, note)
      VALUES
        (${userId}, 'recharge', ${sourceType}, ${String(sourceId)}, ${idempotencyKey},
         ${amount}, 0, ${newBalance}, ${account.held_points}, ${note || null})
      ON CONFLICT (idempotency_key) DO UPDATE
        SET idempotency_key = EXCLUDED.idempotency_key
      RETURNING *
    `;

    logger.info("points.recharge", { userId, amount, sourceId, ledgerId: ledger.id });
    return { success: true, ledger, newBalance };
  };

  return externalTx ? run(externalTx) : sql.begin(run);
};

/**
 * 根据场景/模型/时长/尺寸查询计费规则，返回 points_cost
 */
export const resolveCharge = async ({ outputType, provider, sceneKey, model, seconds, size }) => {
  const rules = await sql`
    SELECT points_cost, priority FROM generation_charge_rules
    WHERE output_type = ${outputType}
      AND provider = ${provider}
      AND is_active = true
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

/**
 * 获取用户账户信息（不加锁，用于只读展示）
 */
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
