import asyncHandler from "../utils/asyncHandler.js";
import User from "../models/userModel.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { sendVerificationEmail, sendPasswordResetEmail, sendChangePasswordOtpEmail } from "../utils/email.js";

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const SUPER_ADMIN_EMAIL = normalizeEmail(process.env.SUPER_ADMIN_EMAIL || "");
const ADMIN_AUTH_COOKIE = "mockyo_admin_token";
const ADMIN_CSRF_COOKIE = "mockyo_admin_csrf";
const USER_AUTH_COOKIE = "mockyo_user_token";

const createCsrfToken = () => crypto.randomBytes(24).toString("hex");

const readCookie = (cookieHeader, key) => {
  const target = `${key}=`;
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(target))
    ?.slice(target.length) || "";
};

const getAdminCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 8 * 60 * 60 * 1000,
  path: "/",
});

const getAdminCsrfCookieOptions = () => ({
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 8 * 60 * 60 * 1000,
  path: "/",
});

const getUserCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
});

const createEmailVerificationToken = () => {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  return { token, tokenHash, expiresAt };
};

const CHANGE_PASSWORD_OTP_MIN_INTERVAL_MS = 60 * 1000;
const MAX_FAILED_OTP_ATTEMPTS = 5;

const buildVerifyUrl = (email, token) => {
  const frontendUrl = String(process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173")
    .trim()
    .replace(/\/+$/, "");

  const params = new URLSearchParams({ email, token });
  return `${frontendUrl}/verify-email?${params.toString()}`;
};

const sendAccountVerification = async ({ email, name, token }) => {
  const verificationUrl = buildVerifyUrl(email, token);
  await sendVerificationEmail({
    to: email,
    name,
    verificationUrl,
  });
};

export const signup = asyncHandler(async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!name) {
    const error = new Error("Name is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!email) {
    const error = new Error("Email is required.");
    error.statusCode = 400;
    throw error;
  }

  if (password.length < 6) {
    const error = new Error("Password must be at least 6 characters.");
    error.statusCode = 400;
    throw error;
  }

  const exists = await User.findOne({ email });
  if (exists) {
    if (exists.authProvider === "google" && !exists.passwordHash) {
      const error = new Error("This account uses Google Sign-In. Please continue with Google.");
      error.statusCode = 409;
      throw error;
    }

    if (exists.isEmailVerified) {
      const error = new Error("Email is already registered.");
      error.statusCode = 409;
      throw error;
    }

    const { token, tokenHash, expiresAt } = createEmailVerificationToken();
    exists.name = name || exists.name;
    exists.passwordHash = hashPassword(password);
    exists.authProvider = "local";
    exists.emailVerificationTokenHash = tokenHash;
    exists.emailVerificationExpiresAt = expiresAt;
    await exists.save();

    await sendAccountVerification({
      email: exists.email,
      name: exists.name,
      token,
    });

    res.json({
      ok: true,
      requiresEmailVerification: true,
      message: "Verification email sent. Please check your inbox.",
    });
    return;
  }

  const { token, tokenHash, expiresAt } = createEmailVerificationToken();

  const created = await User.create({
    name,
    email,
    passwordHash: hashPassword(password),
    authProvider: "local",
    isEmailVerified: false,
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpiresAt: expiresAt,
  });

  try {
    await sendAccountVerification({
      email: created.email,
      name: created.name,
      token,
    });
  } catch (error) {
    await User.findByIdAndDelete(created._id);
    throw error;
  }

  res.status(201).json({
    ok: true,
    requiresEmailVerification: true,
    message: "Account created. Check your email to verify your account.",
  });
});

export const login = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    const error = new Error("Email and password are required.");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  if (user.authProvider === "google" && !user.passwordHash) {
    const error = new Error("This account uses Google Sign-In. Please continue with Google.");
    error.statusCode = 400;
    throw error;
  }

  if (user.authProvider === "local" && !user.isEmailVerified) {
    const error = new Error("Please verify your email before signing in.");
    error.statusCode = 403;
    throw error;
  }

  const valid = verifyPassword(password, user.passwordHash);
  if (!valid) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  const jwtSecret = String(process.env.JWT_SECRET || "");
  if (!jwtSecret) {
    const error = new Error("Server configuration error.");
    error.statusCode = 500;
    throw error;
  }

  const token = jwt.sign(
    { id: String(user._id), email: user.email, role: user.role || "User" },
    jwtSecret,
    { expiresIn: "7d" },
  );

  res.cookie(USER_AUTH_COOKIE, token, getUserCookieOptions());

  res.json({
    ok: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

export const adminLogin = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    const error = new Error("Email and password are required.");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  if (user.authProvider === "google" && !user.passwordHash) {
    const error = new Error("This account uses Google Sign-In. Please continue with Google.");
    error.statusCode = 400;
    throw error;
  }

  if (user.authProvider === "local" && !user.isEmailVerified) {
    const error = new Error("Please verify your email before signing in.");
    error.statusCode = 403;
    throw error;
  }

  const valid = verifyPassword(password, user.passwordHash);
  if (!valid) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  const isSuperAdmin = email === SUPER_ADMIN_EMAIL;
  const hasAdminAccess = isSuperAdmin || user.role === "Admin";

  if (!hasAdminAccess) {
    const error = new Error("You are not allowed to access admin panel.");
    error.statusCode = 403;
    throw error;
  }

  if (isSuperAdmin && user.role !== "Admin") {
    user.role = "Admin";
    await user.save();
  }

  const jwtSecret = String(process.env.JWT_SECRET || "");
  if (!jwtSecret) {
    const error = new Error("Server configuration error.");
    error.statusCode = 500;
    throw error;
  }

  const token = jwt.sign(
    { id: String(user._id), email: user.email, role: "Admin" },
    jwtSecret,
    { expiresIn: "8h" },
  );
  const csrfToken = createCsrfToken();

  res.cookie(ADMIN_AUTH_COOKIE, token, getAdminCookieOptions());
  res.cookie(ADMIN_CSRF_COOKIE, csrfToken, getAdminCsrfCookieOptions());

  res.json({
    ok: true,
    admin: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: "Admin",
    },
  });
});

export const adminLogout = asyncHandler(async (_req, res) => {
  res.clearCookie(ADMIN_AUTH_COOKIE, {
    ...getAdminCookieOptions(),
    maxAge: undefined,
  });
  res.clearCookie(ADMIN_CSRF_COOKIE, {
    ...getAdminCsrfCookieOptions(),
    maxAge: undefined,
  });

  res.json({ ok: true, message: "Signed out successfully." });
});

export const userLogout = asyncHandler(async (_req, res) => {
  res.clearCookie(USER_AUTH_COOKIE, {
    ...getUserCookieOptions(),
    maxAge: undefined,
  });

  res.json({ ok: true, message: "Signed out successfully." });
});

export const issueAdminCsrfToken = asyncHandler(async (_req, res) => {
  const token = readCookie(_req.headers.cookie, ADMIN_AUTH_COOKIE);
  if (!token) {
    const error = new Error("Admin authentication is required.");
    error.statusCode = 401;
    throw error;
  }

  const jwtSecret = String(process.env.JWT_SECRET || "");
  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (decoded?.role !== "Admin") {
      const error = new Error("You are not allowed to access admin panel.");
      error.statusCode = 403;
      throw error;
    }
  } catch {
    const error = new Error("Invalid or expired admin session. Please log in again.");
    error.statusCode = 401;
    throw error;
  }

  const csrfToken = createCsrfToken();
  res.cookie(ADMIN_CSRF_COOKIE, csrfToken, getAdminCsrfCookieOptions());
  res.json({ ok: true, csrfToken });
});

export const googleAuth = asyncHandler(async (req, res) => {
  const credential = String(req.body?.credential || "").trim();
  const googleClientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

  if (!credential) {
    const error = new Error("Google credential is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!googleClientId || !googleClient) {
    const error = new Error("Google sign-in is not configured on the server.");
    error.statusCode = 500;
    throw error;
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: googleClientId,
  });

  const payload = ticket.getPayload();
  const email = normalizeEmail(payload?.email);
  const googleId = String(payload?.sub || "").trim();
  const name = String(payload?.name || "").trim();
  const avatar = String(payload?.picture || "").trim();

  if (!email || !googleId) {
    const error = new Error("Unable to validate Google account details.");
    error.statusCode = 401;
    throw error;
  }

  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      name: name || email.split("@")[0],
      email,
      authProvider: "google",
      googleId,
      avatar,
      isEmailVerified: true,
    });
  } else {
    const updates = {};

    if (!user.googleId) updates.googleId = googleId;
    if (!user.avatar && avatar) updates.avatar = avatar;
    if (!user.name && name) updates.name = name;
    if (user.authProvider !== "google") updates.authProvider = "google";
    if (!user.isEmailVerified) updates.isEmailVerified = true;
    if (user.emailVerificationTokenHash) updates.emailVerificationTokenHash = "";
    if (user.emailVerificationExpiresAt) updates.emailVerificationExpiresAt = null;

    if (Object.keys(updates).length) {
      user = await User.findByIdAndUpdate(user._id, updates, { new: true, runValidators: true });
    }
  }

  const jwtSecret = String(process.env.JWT_SECRET || "");
  if (!jwtSecret) {
    const error = new Error("Server configuration error.");
    error.statusCode = 500;
    throw error;
  }

  const token = jwt.sign(
    { id: String(user._id), email: user.email, role: user.role || "User" },
    jwtSecret,
    { expiresIn: "7d" },
  );

  res.cookie(USER_AUTH_COOKIE, token, getUserCookieOptions());

  res.json({
    ok: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || "",
      authProvider: user.authProvider,
    },
  });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    const error = new Error("Email is required.");
    error.statusCode = 400;
    throw error;
  }

  // Always return the same message to prevent email enumeration.
  const genericMessage = "If an account with this email exists, a password reset link has been sent.";

  const user = await User.findOne({ email });
  if (!user || (user.authProvider === "google" && !user.passwordHash)) {
    res.json({ ok: true, message: genericMessage });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpiresAt = expiresAt;
  await user.save();

  const frontendUrl = String(process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173")
    .trim()
    .replace(/\/+$/, "");
  const params = new URLSearchParams({ email, token });
  const resetUrl = `${frontendUrl}/reset-password?${params.toString()}`;

  try {
    await sendPasswordResetEmail({ to: email, name: user.name, resetUrl });
  } catch (err) {
    user.passwordResetTokenHash = "";
    user.passwordResetExpiresAt = null;
    await user.save();
    throw err;
  }

  res.json({ ok: true, message: genericMessage });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const token = String(req.body?.token || "").trim();
  const newPassword = String(req.body?.newPassword || "");

  if (!email || !token) {
    const error = new Error("Email and token are required.");
    error.statusCode = 400;
    throw error;
  }

  if (newPassword.length < 6) {
    const error = new Error("New password must be at least 6 characters.");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("Invalid or expired reset link.");
    error.statusCode = 400;
    throw error;
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const isExpired = !user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now();

  if (!user.passwordResetTokenHash || user.passwordResetTokenHash !== tokenHash || isExpired) {
    user.passwordResetTokenHash = "";
    user.passwordResetExpiresAt = null;
    await user.save();
    const error = new Error("Reset link is invalid or expired. Please request a new one.");
    error.statusCode = 400;
    throw error;
  }

  user.passwordHash = hashPassword(newPassword);
  user.passwordResetTokenHash = "";
  user.passwordResetExpiresAt = null;
  await user.save();

  res.json({ ok: true, message: "Password reset successful. Please sign in with your new password." });
});

export const sendChangePasswordOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.authUser?.email || req.body?.email);

  if (!email) {
    const error = new Error("Email is required.");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  if (user.authProvider === "google" && !user.passwordHash) {
    const error = new Error("This account uses Google Sign-In. You cannot change a password.");
    error.statusCode = 400;
    throw error;
  }

  const now = Date.now();
  const cooldownUntil = Number(user.changePasswordOtpCooldownUntil || 0);
  if (cooldownUntil > now) {
    const waitSeconds = Math.ceil((cooldownUntil - now) / 1000);
    const error = new Error(`Please wait ${waitSeconds}s before requesting another code.`);
    error.statusCode = 429;
    throw error;
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  user.changePasswordOtpHash = otpHash;
  user.changePasswordOtpExpiresAt = expiresAt;
  user.changePasswordOtpAttempts = 0;
  user.changePasswordOtpCooldownUntil = new Date(now + CHANGE_PASSWORD_OTP_MIN_INTERVAL_MS);
  await user.save();

  await sendChangePasswordOtpEmail({ to: email, name: user.name, otp });

  res.json({ ok: true, message: "Verification code sent to your email." });
});

export const verifyChangePasswordOtp = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.authUser?.email || req.body?.email);
  const otp = String(req.body?.otp || "").trim();

  if (!email || !otp) {
    const error = new Error("Email and OTP are required.");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("Invalid code.");
    error.statusCode = 400;
    throw error;
  }

  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
  const isExpired = !user.changePasswordOtpExpiresAt || user.changePasswordOtpExpiresAt.getTime() < Date.now();

  if (!user.changePasswordOtpHash || user.changePasswordOtpHash !== otpHash || isExpired) {
    const nextAttempts = Number(user.changePasswordOtpAttempts || 0) + 1;
    user.changePasswordOtpAttempts = nextAttempts;
    if (nextAttempts >= MAX_FAILED_OTP_ATTEMPTS) {
      user.changePasswordOtpHash = "";
      user.changePasswordOtpExpiresAt = null;
      user.changePasswordOtpCooldownUntil = new Date(Date.now() + 15 * 60 * 1000);
      user.changePasswordOtpAttempts = 0;
    }
    await user.save();

    const error = new Error(isExpired ? "Code has expired. Please request a new one." : "Invalid verification code.");
    error.statusCode = 400;
    throw error;
  }

  // Clear OTP after successful verification so it can't be reused
  user.changePasswordOtpHash = "";
  user.changePasswordOtpExpiresAt = null;
  user.changePasswordOtpCooldownUntil = null;
  user.changePasswordOtpAttempts = 0;
  await user.save();

  res.json({ ok: true, message: "Code verified." });
});

export const changePassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.authUser?.email || req.body?.email);
  const oldPassword = String(req.body?.oldPassword || "");
  const newPassword = String(req.body?.newPassword || "");

  if (!email) {
    const error = new Error("Email is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!oldPassword) {
    const error = new Error("Current password is required.");
    error.statusCode = 400;
    throw error;
  }

  if (newPassword.length < 6) {
    const error = new Error("New password must be at least 6 characters.");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  if (user.authProvider === "google" && !user.passwordHash) {
    const error = new Error("This account uses Google Sign-In. You cannot set a password.");
    error.statusCode = 400;
    throw error;
  }

  const isValidOldPassword = verifyPassword(oldPassword, user.passwordHash);
  if (!isValidOldPassword) {
    const error = new Error("Current password is incorrect.");
    error.statusCode = 401;
    throw error;
  }

  user.passwordHash = hashPassword(newPassword);
  await user.save();

  res.json({
    ok: true,
    message: "Password changed successfully.",
  });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email || req.query?.email);
  const token = String(req.body?.token || req.query?.token || "").trim();

  if (!email || !token) {
    const error = new Error("Email and token are required.");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("Invalid verification link.");
    error.statusCode = 400;
    throw error;
  }

  if (user.isEmailVerified) {
    res.json({ ok: true, message: "Email already verified." });
    return;
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const isExpired = !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt.getTime() < Date.now();

  if (!user.emailVerificationTokenHash || user.emailVerificationTokenHash !== tokenHash || isExpired) {
    user.emailVerificationTokenHash = "";
    user.emailVerificationExpiresAt = null;
    await user.save();

    const error = new Error("Verification link is invalid or expired. Please request a new one.");
    error.statusCode = 400;
    throw error;
  }

  user.isEmailVerified = true;
  user.emailVerificationTokenHash = "";
  user.emailVerificationExpiresAt = null;
  await user.save();

  res.json({ ok: true, message: "Email verified successfully." });
});

export const resendVerificationEmail = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const genericMessage = "If an account with this email exists and is pending verification, a verification email has been sent.";

  if (!email) {
    const error = new Error("Email is required.");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ email });
  if (!user) {
    res.json({ ok: true, message: genericMessage });
    return;
  }

  if (user.authProvider !== "local") {
    res.json({ ok: true, message: genericMessage });
    return;
  }

  if (user.isEmailVerified) {
    res.json({ ok: true, message: genericMessage });
    return;
  }

  const { token, tokenHash, expiresAt } = createEmailVerificationToken();
  user.emailVerificationTokenHash = tokenHash;
  user.emailVerificationExpiresAt = expiresAt;
  await user.save();

  await sendAccountVerification({
    email: user.email,
    name: user.name,
    token,
  });

  res.json({ ok: true, message: genericMessage });
});

export const getUsersForAdmin = asyncHandler(async (_req, res) => {
  const users = await User.find()
    .sort({ createdAt: -1 })
    .select("name email role status isEmailVerified totalDownloads downloads createdAt updatedAt")
    .lean();

  res.json({
    ok: true,
    items: users,
  });
});

export const incrementUserDownloads = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.authUser?.email || req.body?.email);

  if (!email) {
    const error = new Error("Email is required.");
    error.statusCode = 400;
    throw error;
  }

  const mockupId = String(req.body?.mockupId || "").trim();
  const productTitle = String(req.body?.productTitle || "Unknown").trim();

  const updated = await User.findOneAndUpdate(
    { email },
    {
      $inc: { totalDownloads: 1 },
      $push: { downloads: { mockupId, productTitle, downloadedAt: new Date() } },
    },
    { new: true, select: "totalDownloads" },
  );

  if (!updated) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  res.json({ ok: true, totalDownloads: updated.totalDownloads });
});

export const getUserByIdForAdmin = asyncHandler(async (req, res) => {
  const userId = String(req.params?.id || "").trim();

  if (!userId) {
    const error = new Error("User id is required.");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(userId)
    .select("name email role status isEmailVerified totalDownloads downloads createdAt updatedAt")
    .lean();

  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  res.json({ ok: true, user });
});

export const updateUserForAdmin = asyncHandler(async (req, res) => {
  const userId = String(req.params?.id || "").trim();
  const role = String(req.body?.role || "").trim();
  const status = String(req.body?.status || "").trim();

  if (!userId) {
    const error = new Error("User id is required.");
    error.statusCode = 400;
    throw error;
  }

  const updates = {};
  if (role) {
    if (!["User", "Admin"].includes(role)) {
      const error = new Error("Invalid role value.");
      error.statusCode = 400;
      throw error;
    }
    updates.role = role;
  }

  if (status) {
    if (!["Active", "Banned"].includes(status)) {
      const error = new Error("Invalid status value.");
      error.statusCode = 400;
      throw error;
    }
    updates.status = status;
  }

  if (!Object.keys(updates).length) {
    const error = new Error("No valid fields to update.");
    error.statusCode = 400;
    throw error;
  }

  const updated = await User.findByIdAndUpdate(userId, updates, {
    new: true,
    runValidators: true,
    select: "name email role status createdAt updatedAt",
  }).lean();

  if (!updated) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  res.json({ ok: true, item: updated });
});

export const deleteUserForAdmin = asyncHandler(async (req, res) => {
  const userId = String(req.params?.id || "").trim();

  if (!userId) {
    const error = new Error("User id is required.");
    error.statusCode = 400;
    throw error;
  }

  const deleted = await User.findByIdAndDelete(userId).lean();
  if (!deleted) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  res.json({ ok: true, message: "User deleted successfully." });
});
