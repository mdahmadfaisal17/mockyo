import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
	adminLogin,
	adminLogout,
	issueAdminCsrfToken,
	changePassword,
	deleteUserForAdmin,
	forgotPassword,
	getUserByIdForAdmin,
	getUsersForAdmin,
	googleAuth,
	incrementUserDownloads,
	login,
	resendVerificationEmail,
	resetPassword,
	userLogout,
	sendChangePasswordOtp,
	verifyChangePasswordOtp,
	signup,
	updateUserForAdmin,
	verifyEmail,
} from "../controllers/authController.js";
import requireAdminAccess from "../middlewares/requireAdminAccess.js";
import requireUserAccess from "../middlewares/requireUserAccess.js";

const router = Router();

const otpRateLimit = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 8,
	standardHeaders: true,
	legacyHeaders: false,
	message: { ok: false, message: "Too many verification attempts. Please try again later." },
});

router.post("/signup", signup);
router.post("/login", login);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);
router.post("/admin/login", adminLogin);
router.post("/admin/logout", adminLogout);
router.get("/admin/csrf-token", issueAdminCsrfToken);
router.post("/logout", userLogout);
router.post("/google", googleAuth);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", requireUserAccess, changePassword);
router.post("/send-change-password-otp", otpRateLimit, requireUserAccess, sendChangePasswordOtp);
router.post("/verify-change-password-otp", otpRateLimit, requireUserAccess, verifyChangePasswordOtp);
router.post("/users/downloads/increment", requireUserAccess, incrementUserDownloads);
router.get("/users", requireAdminAccess, getUsersForAdmin);
router.get("/users/:id", requireAdminAccess, getUserByIdForAdmin);
router.patch("/users/:id", requireAdminAccess, updateUserForAdmin);
router.delete("/users/:id", requireAdminAccess, deleteUserForAdmin);

export default router;
