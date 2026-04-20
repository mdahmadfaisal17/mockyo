import { Router } from "express";
import requireAdminAccess from "../middlewares/requireAdminAccess.js";
import { getCategoryConfig, upsertCategoryConfig } from "../controllers/categoryConfigController.js";

const router = Router();

router.get("/config", getCategoryConfig);
router.put("/config", requireAdminAccess, upsertCategoryConfig);

export default router;
