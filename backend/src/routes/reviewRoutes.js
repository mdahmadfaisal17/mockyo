import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import requireAdminAccess from "../middlewares/requireAdminAccess.js";
import requireUserAccess from "../middlewares/requireUserAccess.js";
import {
  approveReview,
  createReview,
  deleteReview,
  getApprovedReviews,
  getPendingReviews,
} from "../controllers/reviewController.js";

const router = Router();

const reviewCreateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Too many review attempts. Please try again later." },
});

router.get("/", getApprovedReviews);
router.post("/", reviewCreateRateLimit, requireUserAccess, createReview);
router.get("/pending", requireAdminAccess, getPendingReviews);
router.patch("/:id/approve", requireAdminAccess, approveReview);
router.delete("/:id", requireAdminAccess, deleteReview);

export default router;
