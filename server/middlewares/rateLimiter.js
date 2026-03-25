import rateLimit from "express-rate-limit";

/**
 * 生成接口专项限流：每分钟最多 5 次
 * 在路由层直接挂载，保证执行顺序正确（Bug 3 修复）
 */
export const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: "RATE_LIMITED", message: "Max 5 generation requests per minute." },
});
