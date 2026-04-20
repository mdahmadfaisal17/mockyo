import { Router } from "express";
import {
  createMockup,
  deleteMockup,
  getMockupById,
  getMockups,
  updateMockup,
  downloadFile,
  getDownloadPresignedUrl,
  incrementMockupDownloads,
} from "../controllers/mockupController.js";
import upload from "../middlewares/upload.js";
import requireAdminAccess from "../middlewares/requireAdminAccess.js";

const router = Router();

const uploadFields = upload.fields([
  { name: "thumbnails", maxCount: 4 },
  { name: "artboardLayers", maxCount: 20 },
  { name: "designAreaImages", maxCount: 20 },
  { name: "sizeImages", maxCount: 20 },
  { name: "colorAreaImages", maxCount: 20 },
  { name: "defaultImages", maxCount: 20 },
  { name: "primaryBaseMockup", maxCount: 1 },
  { name: "primaryOverlayImage", maxCount: 1 },
  { name: "frontBaseMockup", maxCount: 1 },
  { name: "frontOverlayImage", maxCount: 1 },
  { name: "backBaseMockup", maxCount: 1 },
  { name: "backOverlayImage", maxCount: 1 },
  { name: "multiply", maxCount: 1 },
  { name: "screen", maxCount: 1 },
  { name: "overlay", maxCount: 1 },
  { name: "designAreaBody", maxCount: 1 },
  { name: "designAreaLeftSleeve", maxCount: 1 },
  { name: "designAreaRightSleeve", maxCount: 1 },
  { name: "colorAreaBody", maxCount: 1 },
  { name: "colorAreaSleeves", maxCount: 1 },
  { name: "colorAreaCollar", maxCount: 1 },
]);

router.get("/", getMockups);
router.get("/download/presigned-url", getDownloadPresignedUrl);
router.get("/download/file", downloadFile);
router.post("/:id/downloads/increment", incrementMockupDownloads);
router.get("/:id", getMockupById);
router.post("/", requireAdminAccess, uploadFields, createMockup);
router.put("/:id", requireAdminAccess, uploadFields, updateMockup);
router.delete("/:id", requireAdminAccess, deleteMockup);

export default router;
