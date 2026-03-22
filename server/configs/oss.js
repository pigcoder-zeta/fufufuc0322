/**
 * 阿里云 OSS 配置与工具函数
 * 替代原 Cloudinary 方案
 *
 * 环境变量：
 *   OSS_REGION            e.g. oss-cn-hangzhou
 *   OSS_ENDPOINT          e.g. oss-cn-hangzhou.aliyuncs.com （或 VPC 内网端点）
 *   OSS_BUCKET            bucket 名称
 *   OSS_ACCESS_KEY_ID     阿里云 AccessKey ID
 *   OSS_ACCESS_KEY_SECRET 阿里云 AccessKey Secret
 *   OSS_BASE_URL          可选，CDN 或公网访问域名，如 https://cdn.example.com
 */
import OSS from "ali-oss";
import { Readable } from "stream";
import axios from "axios";
import logger from "./logger.js";

let client;

export const getOSSClient = () => {
  if (!client) {
    client = new OSS({
      region:          process.env.OSS_REGION          || "oss-cn-hangzhou",
      endpoint:        process.env.OSS_ENDPOINT        || undefined,
      bucket:          process.env.OSS_BUCKET          || "quickai",
      accessKeyId:     process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      timeout:         60_000,
    });
  }
  return client;
};

/**
 * 从远程 URL 下载后上传到 OSS
 * @param {string} remoteUrl   Provider 返回的临时 URL
 * @param {string} objectKey   OSS 存储路径，如 quickai/userId/image_123.jpg
 * @param {string} contentType MIME type
 * @returns {{ objectKey, url }}  objectKey 用于存库；url 用于展示（CDN/公网）
 */
export const uploadFromUrl = async (remoteUrl, objectKey, contentType = "image/jpeg") => {
  const oss = getOSSClient();

  // 下载 Provider 临时文件
  const response = await axios.get(remoteUrl, {
    responseType: "arraybuffer",
    timeout: 120_000,
  });

  const buffer = Buffer.from(response.data);

  await oss.put(objectKey, buffer, {
    headers: { "Content-Type": contentType },
  });

  const baseUrl = process.env.OSS_BASE_URL
    ? process.env.OSS_BASE_URL.replace(/\/$/, "")
    : `https://${process.env.OSS_BUCKET}.${process.env.OSS_ENDPOINT || "oss-cn-hangzhou.aliyuncs.com"}`;

  const url = `${baseUrl}/${objectKey}`;

  logger.info("oss.upload.success", { objectKey, size: buffer.length });

  return { objectKey, url };
};

/**
 * 生成 OSS 短时效签名下载 URL（默认 5 分钟）
 * @param {string} objectKey
 * @param {number} expiresSeconds
 */
export const getSignedDownloadUrl = (objectKey, expiresSeconds = 300) => {
  const oss = getOSSClient();
  const url = oss.signatureUrl(objectKey, { expires: expiresSeconds });
  return url;
};

/**
 * 删除 OSS 对象（清理任务用）
 * @param {string} objectKey
 */
export const deleteObject = async (objectKey) => {
  if (!objectKey) return;
  try {
    const oss = getOSSClient();
    await oss.delete(objectKey);
    logger.info("oss.delete.success", { objectKey });
  } catch (err) {
    logger.warn("oss.delete.failed", { objectKey, error: err.message });
  }
};

/**
 * 批量删除 OSS 对象
 * @param {string[]} objectKeys
 */
export const deleteObjects = async (objectKeys) => {
  const validKeys = objectKeys.filter(Boolean);
  if (validKeys.length === 0) return;
  try {
    const oss = getOSSClient();
    await oss.deleteMulti(validKeys, { quiet: true });
    logger.info("oss.deleteMulti.success", { count: validKeys.length });
  } catch (err) {
    logger.warn("oss.deleteMulti.failed", { error: err.message });
  }
};

/**
 * 生成 OSS 对象 Key
 * 格式：quickai/{userId}/{type}_{timestamp}.{ext}
 */
export const buildObjectKey = (userId, type, ext = "jpg") => {
  return `quickai/${userId}/${type}_${Date.now()}.${ext}`;
};
