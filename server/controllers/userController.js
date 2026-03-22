import sql from "../configs/db.js";
import archiver from "archiver";
import { Parser } from "json2csv";
import axios from "axios";
import { getSignedDownloadUrl } from "../configs/oss.js";
import logger from "../configs/logger.js";

// ─────────────────────────────────────────────
// GET /api/user/get-user-creations
// ─────────────────────────────────────────────
export const getUserCreations = async (req, res) => {
  try {
    const { userId } = req.auth;
    const page      = Math.max(1, parseInt(req.query.page      || "1", 10));
    const page_size = Math.min(100, Math.max(1, parseInt(req.query.page_size || "20", 10)));
    const type      = req.query.type   || null;
    const status    = req.query.status || null;
    const offset    = (page - 1) * page_size;

    const creations = await sql`
      SELECT id, type, scene_key, scene_name, provider, model,
             status, provider_status, task_id,
             content, thumbnail_url,
             points_reserved, points_cost,
             prompt, error_message,
             created_at, expires_at
      FROM creations
      WHERE user_id = ${userId}
        AND (${type}::text   IS NULL OR type   = ${type})
        AND (${status}::text IS NULL OR status = ${status})
      ORDER BY created_at DESC
      LIMIT ${page_size} OFFSET ${offset}
    `;

    res.json({ success: true, creations, page, page_size });
  } catch (err) {
    logger.error("getUserCreations.error", { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/user/creations/:creationId/download
// ─────────────────────────────────────────────
export const downloadSingle = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { creationId } = req.params;

    const [creation] = await sql`
      SELECT id, type, content, content_object_key, status, expires_at
      FROM creations
      WHERE id = ${creationId} AND user_id = ${userId}
    `;

    if (!creation) return res.status(404).json({ success: false, message: "Creation not found" });
    if (creation.status !== "completed") {
      return res.status(400).json({ success: false, message: "Creation is not completed" });
    }
    if (creation.expires_at && new Date(creation.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: "Creation has expired" });
    }
    if (!creation.content) {
      return res.status(400).json({ success: false, message: "No content available" });
    }

    // 优先用 OSS 签名 URL（300 秒有效）
    if (creation.content_object_key) {
      try {
        const signedUrl = getSignedDownloadUrl(creation.content_object_key, 300);
        return res.json({
          success: true,
          data: { download_url: signedUrl, expires_in_seconds: 300 },
        });
      } catch (signErr) {
        logger.warn("downloadSingle.sign.failed", { error: signErr.message });
      }
    }

    // fallback：直接返回内容 URL
    res.json({
      success: true,
      data: { download_url: creation.content, expires_in_seconds: 3600 },
    });
  } catch (err) {
    logger.error("downloadSingle.error", { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/user/creations/download/batch
// ─────────────────────────────────────────────
export const batchDownload = async (req, res) => {
  try {
    const { userId } = req.auth;
    const { creation_ids } = req.body;

    if (!creation_ids || !Array.isArray(creation_ids) || creation_ids.length === 0) {
      return res.status(400).json({ success: false, message: "creation_ids must be a non-empty array" });
    }
    if (creation_ids.length > 20) {
      return res.status(400).json({ success: false, message: "Maximum 20 items per batch" });
    }

    const now = new Date();
    const creations = await sql`
      SELECT id, content, content_object_key, type
      FROM creations
      WHERE id = ANY(${creation_ids}::bigint[])
        AND user_id   = ${userId}
        AND status    = 'completed'
        AND (expires_at IS NULL OR expires_at > ${now.toISOString()})
    `;

    if (creations.length === 0) {
      return res.status(404).json({ success: false, message: "No valid creations found" });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="creations_batch.zip"');

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.pipe(res);

    for (const item of creations) {
      const downloadUrl = item.content_object_key
        ? getSignedDownloadUrl(item.content_object_key, 300)
        : item.content;

      if (!downloadUrl) continue;

      try {
        const response = await axios.get(downloadUrl, { responseType: "arraybuffer", timeout: 30_000 });
        const ext = item.type === "video" ? "mp4" : "jpg";
        archive.append(Buffer.from(response.data), { name: `${item.id}.${ext}` });
      } catch (e) {
        logger.warn("batchDownload.item.failed", { id: item.id, error: e.message });
      }
    }

    archive.on("error", (err) => logger.error("batchDownload.archive.error", { error: err.message }));
    await archive.finalize();
  } catch (err) {
    logger.error("batchDownload.error", { error: err.message });
    if (!res.headersSent) res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/user/creations/export/csv
// ─────────────────────────────────────────────
export const exportCSV = async (req, res) => {
  try {
    const { userId } = req.auth;
    const now = new Date();

    const creations = await sql`
      SELECT id, type, scene_key, scene_name, provider, model,
             status, points_cost, prompt, content, thumbnail_url,
             created_at, expires_at
      FROM creations
      WHERE user_id  = ${userId}
        AND (expires_at IS NULL OR expires_at > ${now.toISOString()})
      ORDER BY created_at DESC
    `;

    if (creations.length === 0) {
      return res.status(404).json({ success: false, message: "No valid creations to export" });
    }

    const fields = [
      "id", "type", "scene_key", "scene_name", "provider", "model",
      "status", "points_cost", "prompt", "content", "thumbnail_url",
      "created_at", "expires_at",
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(creations);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="creations_history.csv"');
    res.status(200).send("\uFEFF" + csv);
  } catch (err) {
    logger.error("exportCSV.error", { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};
