import express from "express";
import {
  getUserCreations,
  downloadSingle,
  batchDownload,
  exportCSV,
} from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.get("/get-user-creations", getUserCreations);
userRouter.get("/creations/:creationId/download", downloadSingle);
userRouter.post("/creations/download/batch", batchDownload);
userRouter.get("/creations/export/csv", exportCSV);

export default userRouter;
