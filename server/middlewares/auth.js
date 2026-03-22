/**
 * Authing 认证中间件
 *
 * 验证流程：
 *  1. 从 Authorization: Bearer <token> 提取 token
 *  2. 从 Authing JWKS 端点获取公钥（带缓存）
 *  3. 用 jsonwebtoken 验签，提取 sub 作为 userId
 *  4. 将 { userId } 挂载到 req.auth
 *
 * 环境变量：
 *   AUTHING_APP_ID    Authing 应用 App ID
 *   AUTHING_APP_HOST  Authing 应用域名，如 https://your-app.authing.cn
 */
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import logger from "../configs/logger.js";

const AUTHING_APP_HOST = process.env.AUTHING_APP_HOST;
const AUTHING_APP_ID   = process.env.AUTHING_APP_ID;

// JWKS 客户端（带缓存，5分钟更新一次）
let jwksClientInstance;
const getJwksClient = () => {
  if (!jwksClientInstance && AUTHING_APP_HOST) {
    jwksClientInstance = jwksClient({
      jwksUri: `${AUTHING_APP_HOST.replace(/\/$/, "")}/.well-known/jwks.json`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 5 * 60 * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }
  return jwksClientInstance;
};

/**
 * 获取签名公钥
 */
const getSigningKey = (header) =>
  new Promise((resolve, reject) => {
    const client = getJwksClient();
    if (!client) {
      return reject(new Error("Authing JWKS client not initialized (AUTHING_APP_HOST not set)"));
    }
    client.getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });

/**
 * 验证 Authing JWT
 */
const verifyToken = async (token) => {
  // 先解码 header 以获取 kid
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header) {
    throw Object.assign(new Error("Invalid token format"), { status: 401 });
  }

  const signingKey = await getSigningKey(decoded.header);

  const payload = jwt.verify(token, signingKey, {
    algorithms: ["RS256"],
    audience: AUTHING_APP_ID || undefined,
    issuer: AUTHING_APP_HOST ? `${AUTHING_APP_HOST.replace(/\/$/, "")}/oidc` : undefined,
  });

  return payload;
};

/**
 * requireAuth 中间件
 * 与 Clerk 的 requireAuth() 保持同名接口，方便替换
 */
export const requireAuth = () => async (req, res, next) => {
  // 开发模式：如果未配置 Authing，使用 mock userId（仅限非生产）
  if (!AUTHING_APP_HOST && process.env.NODE_ENV !== "production") {
    const devUserId = req.headers["x-dev-user-id"] || "dev_user_001";
    req.auth = { userId: devUserId };
    logger.warn("auth: AUTHING_APP_HOST not set, using dev userId", { userId: devUserId });
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authorization header required" });
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token);

    // Authing 的用户唯一标识是 sub
    const userId = payload.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Token missing sub claim" });
    }

    req.auth = { userId };
    return next();
  } catch (err) {
    logger.warn("auth.verify.failed", { error: err.message, ip: req.ip });

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, code: "TOKEN_EXPIRED", message: "Token has expired" });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, code: "INVALID_TOKEN", message: "Invalid token" });
    }
    return res.status(401).json({ success: false, message: "Authentication failed" });
  }
};

export default requireAuth;
