import { Router } from "express";
import {
  subscribe,
  getSubscribers,
  deleteSubscriber,
} from "../controllers/subscriberController.js";
import requireAdminAccess from "../middlewares/requireAdminAccess.js";

const router = Router();

router.post("/", subscribe);
router.get("/", requireAdminAccess, getSubscribers);
router.delete("/:id", requireAdminAccess, deleteSubscriber);

export default router;
