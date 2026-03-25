import express from "express";
import {
  getScenes,
  estimatePoints,
  generateSceneImage,
  generateSoraVideo,
  checkVideoStatus,
} from "../controllers/aiController.js";
import { generateLimiter } from "../middlewares/rateLimiter.js";

const aiRouter = express.Router();

aiRouter.get("/scenes", getScenes);
aiRouter.post("/estimate-points", estimatePoints);

// 限流器直接挂在路由上，执行顺序保证正确（Bug 3 修复）
aiRouter.post("/generate-scene-image", generateLimiter, generateSceneImage);
aiRouter.post("/generate-sora-video",  generateLimiter, generateSoraVideo);

aiRouter.get("/video-status/:creationId", checkVideoStatus);

export default aiRouter;
