import sql from "../configs/db.js";
import { uploadFromUrl, buildObjectKey } from "../configs/oss.js";
import { reservePoints, chargePoints, releasePoints, resolveCharge } from "../services/pointsService.js";
import { checkAndGrantBonus } from "../services/membershipService.js";
import { generateImage } from "../providers/imageProvider.js";
import { submitSoraVideoTask, checkSoraVideoStatus } from "../providers/soraAPI.js";
import logger from "../configs/logger.js";

// ─────────────────────────────────────────────
// GET /api/ai/scenes
// ─────────────────────────────────────────────
export const getScenes = async (req, res) => {
  try {
    // Bug 6 修复：target_provider 别名为 provider，对齐 API spec
    const templates = await sql`
      SELECT pt.scene_key, pt.scene_name, pt.output_type,
             pt.target_provider AS provider,
             pt.default_model, pt.default_seconds, pt.default_size,
             gcr.points_cost AS estimated_points
      FROM prompt_templates pt
      LEFT JOIN LATERAL (
        SELECT points_cost FROM generation_charge_rules
        WHERE output_type  = pt.output_type
          AND provider     = pt.target_provider
          AND is_active    = true
          AND (scene_key   = pt.scene_key OR scene_key IS NULL)
        ORDER BY priority ASC
        LIMIT 1
      ) gcr ON true
      WHERE pt.is_active = true
      ORDER BY pt.display_order ASC
    `;

    res.json({ success: true, data: templates });
  } catch (err) {
    logger.error("getScenes.error", { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/ai/estimate-points
// ─────────────────────────────────────────────
export const estimatePoints = async (req, res) => {
  try {
    const { scene_key, output_type, model, seconds, size } = req.body;

    if (!scene_key || !output_type) {
      return res.status(400).json({ success: false, message: "scene_key and output_type are required" });
    }

    const [template] = await sql`
      SELECT target_provider FROM prompt_templates
      WHERE scene_key = ${scene_key} AND is_active = true
    `;

    if (!template) {
      return res.status(400).json({ success: false, message: "Scene not found" });
    }

    const estimated_points = await resolveCharge({
      outputType: output_type,
      provider: template.target_provider,
      sceneKey: scene_key,
      model: model || null,
      seconds: seconds || null,
      size: size || null,
    });

    // Bug 6 修复：target_provider → provider，对齐 spec
    res.json({
      success: true,
      data: {
        scene_key,
        output_type,
        estimated_points,
        currency_unit: "points",
        rule_snapshot: {
          provider: template.target_provider,
          scene_key,
          model:   model   || null,
          seconds: seconds || null,
          size:    size    || null,
        },
      },
    });
  } catch (err) {
    logger.error("estimatePoints.error", { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/ai/generate-scene-image
// ─────────────────────────────────────────────
export const generateSceneImage = async (req, res) => {
  const { userId } = req.auth;
  const idempotencyKey = req.headers["x-idempotency-key"];

  if (!idempotencyKey) {
    return res.status(400).json({ success: false, message: "X-Idempotency-Key header is required" });
  }

  const { scene_key, user_prompt, size } = req.body;
  if (!scene_key || !user_prompt) {
    return res.status(400).json({ success: false, message: "scene_key and user_prompt are required" });
  }

  const finalSize = size || "1024x1024";
  let creationId = null;
  const startTime = Date.now();

  try {
    // 0. 幂等检查
    const [existing] = await sql`
      SELECT id, status, content, thumbnail_url, points_cost, expires_at
      FROM creations
      WHERE user_id = ${userId} AND request_idempotency_key = ${idempotencyKey}
    `;
    if (existing) {
      return res.json({
        success: true,
        creation_id: existing.id,
        status: existing.status,
        content: existing.content,
        thumbnail_url: existing.thumbnail_url,
        points_charged: existing.points_cost,
        expires_at: existing.expires_at,
      });
    }

    // 1. 读取场景模板
    const [template] = await sql`
      SELECT * FROM prompt_templates
      WHERE scene_key = ${scene_key} AND is_active = true
    `;
    if (!template) {
      return res.status(400).json({ success: false, message: "Invalid or inactive scene" });
    }

    // 2. 计算积分
    const pointsCost = await resolveCharge({
      outputType: "image",
      provider: template.target_provider,
      sceneKey: scene_key,
      model: template.default_model,
      seconds: null,
      size: finalSize,
    });

    // 3. 补发会员月赠
    await checkAndGrantBonus(userId);

    // 4. 创建 creation 记录（pending）
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const [creation] = await sql`
      INSERT INTO creations
        (user_id, provider, model, scene_key, scene_name, type, status, charge_status,
         points_reserved, points_cost, request_idempotency_key, expires_at, meta_info)
      VALUES
        (${userId}, ${template.target_provider}, ${template.default_model},
         ${scene_key}, ${template.scene_name}, 'image', 'pending', 'none',
         0, 0, ${idempotencyKey}, ${expiresAt}, ${{}}::jsonb)
      RETURNING id
    `;
    creationId = creation.id;

    // 5. 预占积分
    await reservePoints({
      userId, amount: pointsCost, creationId,
      idempotencyKey: `reserve:${idempotencyKey}`,
      note: `预占：${template.scene_name}`,
    });

    await sql`
      UPDATE creations
      SET charge_status = 'reserved', points_reserved = ${pointsCost}
      WHERE id = ${creationId}
    `;

    // 6. 调用图片 Provider
    const finalPrompt = `${template.system_prompt}\n\n${user_prompt}`;
    const { imageUrl, providerRaw } = await generateImage(finalPrompt, finalSize);

    // 7. 上传 OSS
    let contentUrl = imageUrl;
    let contentObjectKey = null;
    try {
      const objectKey = buildObjectKey(userId, "image", "jpg");
      const uploaded = await uploadFromUrl(imageUrl, objectKey, "image/jpeg");
      contentUrl = uploaded.url;
      contentObjectKey = uploaded.objectKey;
    } catch (uploadErr) {
      logger.warn("oss.upload.failed", { error: uploadErr.message });
    }

    const generationTimeMs = Date.now() - startTime;

    // 8. 结算积分 + 更新记录
    await chargePoints({
      userId, amount: pointsCost, creationId,
      idempotencyKey: `charge:${idempotencyKey}`,
      note: `结算：${template.scene_name}`,
    });

    await sql`
      UPDATE creations
      SET status = 'completed', charge_status = 'charged',
          points_reserved = 0, points_cost = ${pointsCost},
          content = ${contentUrl},
          content_object_key = ${contentObjectKey},
          generation_time_ms = ${generationTimeMs},
          meta_info = ${JSON.stringify({ providerRaw })}::jsonb
      WHERE id = ${creationId}
    `;

    logger.info("generateSceneImage.success", { userId, creationId, pointsCost, generationTimeMs });

    res.json({
      success: true,
      creation_id: creationId,
      status: "completed",
      content: contentUrl,
      thumbnail_url: null,
      points_charged: pointsCost,
      expires_at: expiresAt,
    });

  } catch (err) {
    logger.error("generateSceneImage.error", { userId, creationId, error: err.message });

    if (creationId) {
      try {
        // 从 creation 记录取出实际预占量，保证返还金额正确（Bug 2 修复）
        const [rec] = await sql`SELECT points_reserved FROM creations WHERE id = ${creationId}`.catch(() => []);
        const reservedAmt = rec?.points_reserved ?? 0;
        await releasePoints({
          userId, amount: reservedAmt, creationId,
          idempotencyKey: `release:${idempotencyKey}`,
          note: "返还：图片生成失败",
        }).catch(() => {});

        await sql`
          UPDATE creations
          SET status = 'failed', charge_status = 'released',
              points_reserved = 0, error_message = ${err.message}
          WHERE id = ${creationId}
        `;
      } catch (_) {}
    }

    if (err.code === "INSUFFICIENT_POINTS") {
      return res.status(402).json({
        success: false, code: "INSUFFICIENT_POINTS",
        message: "Available points are insufficient for this request.",
        available_points: err.available_points,
        required_points: err.required_points,
      });
    }

    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/ai/generate-sora-video
// ─────────────────────────────────────────────
export const generateSoraVideo = async (req, res) => {
  const { userId } = req.auth;
  const idempotencyKey = req.headers["x-idempotency-key"];

  if (!idempotencyKey) {
    return res.status(400).json({ success: false, message: "X-Idempotency-Key header is required" });
  }

  const { scene_key, user_prompt, model, seconds, size } = req.body;
  if (!scene_key || !user_prompt) {
    return res.status(400).json({ success: false, message: "scene_key and user_prompt are required" });
  }

  let creationId = null;

  try {
    // 0. 幂等检查
    const [existing] = await sql`
      SELECT id, status, task_id, points_reserved, points_cost, expires_at
      FROM creations
      WHERE user_id = ${userId} AND request_idempotency_key = ${idempotencyKey}
    `;
    if (existing) {
      return res.json({
        success: true, creation_id: existing.id, status: existing.status,
        task_id: existing.task_id, points_reserved: existing.points_reserved,
        expires_at: existing.expires_at, message: "Task already submitted.",
      });
    }

    // 1. 读取场景模板
    const [template] = await sql`
      SELECT * FROM prompt_templates WHERE scene_key = ${scene_key} AND is_active = true
    `;
    if (!template) {
      return res.status(400).json({ success: false, message: "Invalid or inactive scene" });
    }

    const finalModel   = model   || template.default_model   || "sora";
    const finalSeconds = seconds || template.default_seconds || 8;
    const finalSize    = size    || template.default_size    || "720x1280";

    // 2. 计算积分
    const pointsCost = await resolveCharge({
      outputType: "video", provider: template.target_provider,
      sceneKey: scene_key, model: finalModel, seconds: finalSeconds, size: finalSize,
    });

    // 3. 补发会员月赠
    await checkAndGrantBonus(userId);

    // 4. 建记录 + 预占积分
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const [creation] = await sql`
      INSERT INTO creations
        (user_id, provider, model, scene_key, scene_name, type, status, charge_status,
         points_reserved, points_cost, request_idempotency_key, expires_at, meta_info)
      VALUES
        (${userId}, ${template.target_provider}, ${finalModel},
         ${scene_key}, ${template.scene_name}, 'video', 'pending', 'none',
         0, 0, ${idempotencyKey}, ${expiresAt},
         ${JSON.stringify({ seconds: finalSeconds, size: finalSize })}::jsonb)
      RETURNING id
    `;
    creationId = creation.id;

    await reservePoints({
      userId, amount: pointsCost, creationId,
      idempotencyKey: `reserve:${idempotencyKey}`,
      note: `预占：${template.scene_name}`,
    });

    await sql`
      UPDATE creations SET charge_status = 'reserved', points_reserved = ${pointsCost}
      WHERE id = ${creationId}
    `;

    // 5. 提交 Sora 任务
    const finalPrompt = `${template.system_prompt}\n\n${user_prompt}`;
    const result = await submitSoraVideoTask(finalPrompt, finalModel, finalSeconds, finalSize);

    if (!result.success) throw new Error(result.message || "Video task submission failed");

    await sql`
      UPDATE creations
      SET task_id = ${result.taskId}, status = 'pending',
          provider_status = ${result.providerStatus || 'queued'}
      WHERE id = ${creationId}
    `;

    logger.info("generateSoraVideo.submitted", { userId, creationId, taskId: result.taskId, pointsCost });

    res.json({
      success: true, creation_id: creationId, status: "pending",
      provider_status: result.providerStatus || "queued",
      task_id: result.taskId, points_reserved: pointsCost,
      expires_at: expiresAt,
      message: "Video task submitted. Poll the status endpoint for updates.",
    });

  } catch (err) {
    logger.error("generateSoraVideo.error", { userId, creationId, error: err.message });

    if (creationId) {
      // 从 creation 记录取出实际预占量（Bug 2 修复）
      const [rec] = await sql`SELECT points_reserved FROM creations WHERE id = ${creationId}`.catch(() => []);
      const reservedAmt = rec?.points_reserved ?? 0;
      await releasePoints({
        userId, amount: reservedAmt, creationId,
        idempotencyKey: `release:${idempotencyKey}`,
        note: "返还：视频任务提交失败",
      }).catch(() => {});

      await sql`
        UPDATE creations
        SET status = 'failed', charge_status = 'released',
            points_reserved = 0, error_message = ${err.message}
        WHERE id = ${creationId}
      `.catch(() => {});
    }

    if (err.code === "INSUFFICIENT_POINTS") {
      return res.status(402).json({
        success: false, code: "INSUFFICIENT_POINTS",
        message: "Available points are insufficient.",
        available_points: err.available_points, required_points: err.required_points,
      });
    }

    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/ai/video-status/:creationId
// ─────────────────────────────────────────────
export const checkVideoStatus = async (req, res) => {
  const { userId } = req.auth;
  const { creationId } = req.params;

  try {
    const [creation] = await sql`
      SELECT * FROM creations WHERE id = ${creationId} AND user_id = ${userId}
    `;

    if (!creation) return res.status(404).json({ success: false, message: "Creation not found" });

    // 终态直接返回
    if (creation.status === "completed" || creation.status === "failed") {
      return res.json({
        success: true, creation_id: creation.id,
        status: creation.status, provider_status: creation.provider_status,
        progress: creation.status === "completed" ? 100 : 0,
        content: creation.content, thumbnail_url: creation.thumbnail_url,
        points_reserved: creation.points_reserved, points_charged: creation.points_cost,
        error_message: creation.error_message, expires_at: creation.expires_at,
      });
    }

    if (!creation.task_id) {
      return res.status(400).json({ success: false, message: "No task_id for this creation" });
    }

    // 向 Provider 查询
    const result = await checkSoraVideoStatus(creation.task_id);
    if (!result.success) return res.status(500).json({ success: false, message: result.message });

    const rawStatus = result.status.toLowerCase();
    const providerStatusMap = {
      queued: "pending", pending: "pending",
      in_progress: "running", processing: "running",
      completed: "completed", success: "completed",
      failed: "failed", cancelled: "failed", expired: "failed", error: "failed",
    };
    const internalStatus = providerStatusMap[rawStatus] || "running";

    if (internalStatus === "completed" && result.url) {
      // 上传 OSS
      let contentUrl = result.url;
      let contentObjectKey = null;
      let thumbnailUrl = null;
      let thumbnailObjectKey = null;

      try {
        const videoKey = buildObjectKey(userId, "video", "mp4");
        const uploaded = await uploadFromUrl(result.url, videoKey, "video/mp4");
        contentUrl = uploaded.url;
        contentObjectKey = uploaded.objectKey;

        // 生成视频封面缩略图（截取首帧，OSS 媒体处理）
        const ossBase = process.env.OSS_BASE_URL
          ? process.env.OSS_BASE_URL.replace(/\/$/, "")
          : `https://${process.env.OSS_BUCKET}.${process.env.OSS_ENDPOINT || "oss-cn-hangzhou.aliyuncs.com"}`;
        thumbnailUrl = `${ossBase}/${contentObjectKey}?x-oss-process=video/snapshot,t_0,f_jpg,w_640,m_fast`;
        thumbnailObjectKey = contentObjectKey; // 缩略图通过参数从同一对象生成
      } catch (uploadErr) {
        logger.warn("oss.video.upload.failed", { error: uploadErr.message });
      }

      // 结算积分
      await chargePoints({
        userId, amount: creation.points_reserved, creationId: creation.id,
        idempotencyKey: `charge:video:${creation.id}`,
        note: `结算：${creation.scene_name}`,
      }).catch((e) => logger.error("checkVideoStatus.charge.error", { error: e.message }));

      await sql`
        UPDATE creations
        SET status = 'completed', provider_status = ${rawStatus},
            content = ${contentUrl}, content_object_key = ${contentObjectKey},
            thumbnail_url = ${thumbnailUrl}, thumbnail_object_key = ${thumbnailObjectKey},
            charge_status = 'charged', points_cost = ${creation.points_reserved},
            points_reserved = 0,
            meta_info = ${JSON.stringify({ providerRaw: result.raw || {} })}::jsonb
        WHERE id = ${creation.id}
      `;

      return res.json({
        success: true, creation_id: creation.id, status: "completed",
        provider_status: rawStatus, progress: 100,
        content: contentUrl, thumbnail_url: thumbnailUrl,
        points_reserved: 0, points_charged: creation.points_reserved,
        expires_at: creation.expires_at,
      });
    }

    if (internalStatus === "failed") {
      await releasePoints({
        userId, amount: creation.points_reserved, creationId: creation.id,
        idempotencyKey: `release:video:${creation.id}`,
        note: "返还：视频生成失败",
      }).catch(() => {});

      await sql`
        UPDATE creations
        SET status = 'failed', provider_status = ${rawStatus},
            charge_status = 'released', points_reserved = 0,
            error_message = ${result.message || "Generation failed"}
        WHERE id = ${creation.id}
      `;

      return res.json({
        success: true, creation_id: creation.id, status: "failed",
        provider_status: rawStatus, progress: 0,
        content: null, thumbnail_url: null,
        points_reserved: 0, points_charged: 0,
        error_message: result.message || "Generation failed or timed out.",
        expires_at: creation.expires_at,
      });
    }

    // 进行中
    await sql`
      UPDATE creations SET provider_status = ${rawStatus}, status = ${internalStatus}
      WHERE id = ${creation.id}
    `;

    res.json({
      success: true, creation_id: creation.id, status: internalStatus,
      provider_status: rawStatus,
      progress: result.progress || (internalStatus === "running" ? 50 : 10),
      content: null, thumbnail_url: null,
      points_reserved: creation.points_reserved, points_charged: 0,
      expires_at: creation.expires_at,
    });

  } catch (err) {
    logger.error("checkVideoStatus.error", { userId, creationId, error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};
