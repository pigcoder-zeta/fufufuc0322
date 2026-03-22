import express from "express";
import {
  getScenes,
  estimatePoints,
  generateSceneImage,
  generateSoraVideo,
  checkVideoStatus,
} from "../controllers/aiController.js";

const aiRouter = express.Router();

aiRouter.get("/scenes", getScenes);
aiRouter.post("/estimate-points", estimatePoints);
aiRouter.post("/generate-scene-image", generateSceneImage);
aiRouter.post("/generate-sora-video", generateSoraVideo);
aiRouter.get("/video-status/:creationId", checkVideoStatus);

export default aiRouter;
