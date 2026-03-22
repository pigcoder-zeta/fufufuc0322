/**
 * 图片生成 Provider 封装 — Nano Banana 2
 *
 * 兼容 OpenAI Images API 协议。
 * 若环境未配置 IMAGE_PROVIDER_KEY，则退回 mock 模式（仅用于开发联调）。
 */
import axios from "axios";
import logger from "../configs/logger.js";

const API_KEY  = process.env.IMAGE_PROVIDER_KEY;
const BASE_URL = process.env.IMAGE_PROVIDER_BASE_URL || "https://api.nano-banana.io/v1";
const MODEL    = process.env.IMAGE_PROVIDER_MODEL     || "nano-banana-2";

/**
 * 生成图片
 * @param {string} prompt       - 最终提示词（system_prompt + user_prompt 拼接后）
 * @param {string} size         - 例："1024x1024"
 * @returns {{ imageUrl: string, providerRaw: object }}
 */
export const generateImage = async (prompt, size = "1024x1024") => {
  if (!API_KEY) {
    logger.warn("imageProvider: IMAGE_PROVIDER_KEY not set, using mock");
    return mockGenerate(prompt, size);
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/images/generations`,
      {
        model: MODEL,
        prompt,
        n: 1,
        size,
        response_format: "url",
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 120_000,
      }
    );

    const data = response.data;
    const imageUrl = data?.data?.[0]?.url;

    if (!imageUrl) {
      throw new Error("Provider returned no image URL");
    }

    logger.info("imageProvider.generate.success", { size, model: MODEL });

    return {
      imageUrl,
      providerRaw: data,
    };
  } catch (err) {
    logger.error("imageProvider.generate.error", {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    });
    throw err;
  }
};

const mockGenerate = async (prompt, size) => {
  await new Promise((r) => setTimeout(r, 1500));
  logger.info("imageProvider.mock", { prompt: prompt.slice(0, 80), size });
  return {
    imageUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1024&q=80",
    providerRaw: { mock: true, model: "mock", prompt, size },
  };
};
