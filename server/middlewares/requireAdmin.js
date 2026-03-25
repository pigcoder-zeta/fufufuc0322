/**
 * Admin 权限校验中间件（Bug 4 修复）
 *
 * 支持两种校验方式（二选一，优先级从高到低）：
 *  1. 请求头 X-Admin-Key = 环境变量 API_ADMIN_KEY（服务器间调用 / 工具脚本场景）
 *  2. Authing JWT claim 中包含 admin 角色（roles 字段，由 Authing 控制台配置）
 *
 * 环境变量：
 *   API_ADMIN_KEY   服务器静态 admin key（为空时仅走 JWT 角色校验）
 *
 * 注意：requireAdmin 必须在 requireAuth 之后挂载，因为它依赖 req.auth.userId。
 */
import jwt from "jsonwebtoken";
import logger from "../configs/logger.js";

const API_ADMIN_KEY = process.env.API_ADMIN_KEY;

export const requireAdmin = () => (req, res, next) => {
  // 方式 1：静态 Admin Key（优先）
  if (API_ADMIN_KEY) {
    const providedKey = req.headers["x-admin-key"];
    if (providedKey && providedKey === API_ADMIN_KEY) {
      return next();
    }
  }

  // 方式 2：从已验签的 JWT payload 取 roles claim
  // req.authPayload 由 requireAuth 中间件挂载（见下方说明）
  const roles = req.authPayload?.roles ?? req.authPayload?.["https://quickai/roles"] ?? [];
  const roleArray = Array.isArray(roles) ? roles : [roles];

  if (roleArray.includes("admin")) {
    return next();
  }

  logger.warn("requireAdmin.denied", {
    userId: req.auth?.userId,
    ip: req.ip,
    path: req.path,
  });

  return res.status(403).json({
    success: false,
    code: "FORBIDDEN",
    message: "Admin access required.",
  });
};

export default requireAdmin;
