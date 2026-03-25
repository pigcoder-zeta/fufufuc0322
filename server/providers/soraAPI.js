/**
 * Sora Provider 封装 — aimh8.com 聚合接口
 *
 * Base URL: https://www.aimh8.com/agent/openapi/fpbrowser2api
 *
 * 内部状态映射：
 *   queued / pending / processing / in_progress → pending / running
 *   completed / success                         → completed
 *   failed / cancelled / expired / error        → failed
 */
import axios from "axios";
import logger from "../configs/logger.js";

// Bug 5 修复：删除硬编码 fallback，强制从环境变量读取。
// 已泄露的 key 请立即在 aimh8.com 控制台轮换。
const SORA_API_KEY  = process.env.SORA_API_KEY;
const SORA_BASE_URL = process.env.SORA_BASE_URL || "https://www.aimh8.com/agent/openapi/fpbrowser2api";

if (!SORA_API_KEY && process.env.NODE_ENV === "production") {
  logger.error("SORA_API_KEY is not set — video generation will fail in production");
}

const soraClient = axios.create({
  baseURL: SORA_BASE_URL,
  timeout: 60_000,
  headers: { "Content-Type": "application/json" },
});

/**
 * 提交视频生成任务
 * @returns {{ success, taskId, providerStatus, raw }}
 */
export const submitSoraVideoTask = async (prompt, model = "sora", seconds = 8, size = "720x1280") => {
  if (!SORA_API_KEY) {
    if (process.env.NODE_ENV !== "production") {
      logger.warn("soraAPI.submit: SORA_API_KEY not set, using mock");
      return mockSubmit(prompt, model, seconds, size);
    }
    return { success: false, message: "SORA_API_KEY is not configured" };
  }

  try {
    const payload = {
      api_key: SORA_API_KEY,
      action: "submit_task",
      model: model || "sora",
      prompt,
      duration: seconds,
      size,
    };

    logger.info("soraAPI.submit.request", { model, seconds, size, prompt: prompt.slice(0, 80) });

    const response = await soraClient.post("", payload);
    const data = response.data;

    logger.info("soraAPI.submit.response", { data: JSON.stringify(data).slice(0, 200) });

    // 兼容多种返回格式
    const taskId =
      data?.taskId ||
      data?.task_id ||
      data?.id ||
      data?.data?.taskId ||
      data?.data?.id;

    if (!taskId) {
      // 若 API 返回成功但无 taskId，用 mock 兜底（开发环境）
      if (process.env.NODE_ENV !== "production") {
        logger.warn("soraAPI.submit: no taskId in response, falling back to mock");
        return mockSubmit(prompt, model, seconds, size);
      }
      throw new Error(`No taskId in provider response: ${JSON.stringify(data)}`);
    }

    const providerStatus = data?.status || data?.data?.status || "queued";

    return { success: true, taskId, providerStatus, raw: data };
  } catch (err) {
    logger.error("soraAPI.submit.error", {
      message: err.message,
      status: err.response?.status,
      data: JSON.stringify(err.response?.data || {}).slice(0, 200),
    });

    if (process.env.NODE_ENV !== "production") {
      return mockSubmit(prompt, model, seconds, size);
    }
    return { success: false, message: err.message };
  }
};

/**
 * 查询视频任务状态
 * @returns {{ success, status, url, progress, message, raw }}
 */
export const checkSoraVideoStatus = async (taskId) => {
  if (taskId.startsWith("mock_task_")) {
    return mockCheck(taskId);
  }

  try {
    const payload = {
      api_key: SORA_API_KEY,
      action: "check_status",
      taskId,
      task_id: taskId,
    };

    const response = await soraClient.post("", payload);
    const data = response.data;

    logger.info("soraAPI.check.response", { taskId, data: JSON.stringify(data).slice(0, 200) });

    const rawStatus = (data?.status || data?.data?.status || "in_progress").toLowerCase();
    const videoUrl  = data?.url || data?.video_url || data?.data?.url || data?.data?.video_url || null;

    // 进度
    const progress =
      ["completed", "success"].includes(rawStatus) ? 100 :
      ["failed", "error", "cancelled", "expired"].includes(rawStatus) ? 0 :
      data?.progress || 50;

    return {
      success: true,
      status: rawStatus,
      url: videoUrl,
      progress,
      message: data?.message || data?.error || null,
      raw: data,
    };
  } catch (err) {
    logger.error("soraAPI.check.error", { taskId, message: err.message });
    return { success: false, message: err.message };
  }
};

// ─── Mock（开发联调用）─────────────────────────────────
const MOCK_TASKS = new Map();

const mockSubmit = async (prompt, model, seconds, size) => {
  const taskId = `mock_task_${Date.now()}`;
  MOCK_TASKS.set(taskId, {
    status: "queued",
    createdAt: Date.now(),
    readyAt: Date.now() + 12_000,
  });

  logger.info("soraAPI.mock.submit", { taskId });

  return { success: true, taskId, providerStatus: "queued", raw: { mock: true } };
};

const mockCheck = async (taskId) => {
  const task = MOCK_TASKS.get(taskId);
  if (!task) return { success: false, message: "Mock task not found" };

  if (Date.now() >= task.readyAt) {
    MOCK_TASKS.set(taskId, { ...task, status: "completed" });
    return {
      success: true,
      status: "completed",
      url: "https://www.w3schools.com/html/mov_bbb.mp4",
      progress: 100,
      raw: { mock: true },
    };
  }

  return {
    success: true,
    status: "in_progress",
    url: null,
    progress: Math.min(90, Math.floor(((Date.now() - task.createdAt) / (task.readyAt - task.createdAt)) * 100)),
    raw: { mock: true },
  };
};
