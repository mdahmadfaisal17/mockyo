import mongoose from "mongoose";
import Review from "../models/reviewModel.js";
import asyncHandler from "../utils/asyncHandler.js";

const ensureDatabaseReady = () => {
  if (mongoose.connection.readyState !== 1) {
    const error = new Error("Database is not connected. Please verify MongoDB and try again.");
    error.statusCode = 503;
    throw error;
  }
};

const sanitizeReviewText = (value) =>
  String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();

export const getApprovedReviews = asyncHandler(async (_req, res) => {
  ensureDatabaseReady();
  const items = await Review.find({ approved: true })
    .sort({ approvedAt: -1, submittedAt: -1 })
    .limit(500)
    .lean();

  res.json({ ok: true, items });
});

export const getPendingReviews = asyncHandler(async (_req, res) => {
  ensureDatabaseReady();
  const items = await Review.find({ approved: false })
    .sort({ submittedAt: -1 })
    .limit(500)
    .lean();

  res.json({ ok: true, items });
});

export const createReview = asyncHandler(async (req, res) => {
  ensureDatabaseReady();
  const name = String(req.body?.name || "").trim();
  const email = String(req.authUser?.email || "").trim().toLowerCase();
  const text = sanitizeReviewText(req.body?.text);
  const rating = Number(req.body?.rating || 0);

  if (!email) {
    const error = new Error("Please sign in to continue.");
    error.statusCode = 401;
    throw error;
  }

  if (name.length < 2) {
    const error = new Error("Please enter your name.");
    error.statusCode = 400;
    throw error;
  }

  if (rating < 1 || rating > 5) {
    const error = new Error("Rating must be between 1 and 5.");
    error.statusCode = 400;
    throw error;
  }

  if (text.length < 10) {
    const error = new Error("Please write at least 10 characters.");
    error.statusCode = 400;
    throw error;
  }

  if (text.length > 1200) {
    const error = new Error("Review is too long. Please keep it under 1200 characters.");
    error.statusCode = 400;
    throw error;
  }

  const approvedCount = await Review.countDocuments({ email, approved: true });
  if (approvedCount >= 5) {
    const error = new Error("You can only submit up to 5 approved reviews.");
    error.statusCode = 400;
    throw error;
  }

  const recentSubmission = await Review.findOne({ email })
    .sort({ submittedAt: -1 })
    .lean();
  if (recentSubmission?.submittedAt) {
    const msSinceLast = Date.now() - new Date(recentSubmission.submittedAt).getTime();
    if (msSinceLast < 20_000) {
      const error = new Error("Please wait a few seconds before submitting again.");
      error.statusCode = 429;
      throw error;
    }
  }

  const item = await Review.create({
    name,
    email,
    rating,
    text,
    approved: false,
    submittedAt: new Date(),
  });

  res.status(201).json({ ok: true, item });
});

export const approveReview = asyncHandler(async (req, res) => {
  ensureDatabaseReady();
  const { id } = req.params;

  const item = await Review.findById(id);
  if (!item) {
    const error = new Error("Review not found.");
    error.statusCode = 404;
    throw error;
  }

  item.approved = true;
  item.approvedAt = new Date();
  await item.save();

  res.json({ ok: true, item });
});

export const deleteReview = asyncHandler(async (req, res) => {
  ensureDatabaseReady();
  const { id } = req.params;

  const item = await Review.findByIdAndDelete(id);
  if (!item) {
    const error = new Error("Review not found.");
    error.statusCode = 404;
    throw error;
  }

  res.json({ ok: true });
});
