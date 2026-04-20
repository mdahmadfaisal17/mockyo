import mongoose from "mongoose";
import asyncHandler from "../utils/asyncHandler.js";
import CategoryConfig from "../models/categoryConfigModel.js";

const ensureDatabaseReady = () => {
  if (mongoose.connection.readyState !== 1) {
    const error = new Error("Database is not connected. Please verify MongoDB and try again.");
    error.statusCode = 503;
    throw error;
  }
};

export const getCategoryConfig = asyncHandler(async (_req, res) => {
  ensureDatabaseReady();
  const doc = await CategoryConfig.findOne().sort({ updatedAt: -1 }).lean();
  res.json({ ok: true, hierarchy: doc?.hierarchy || {} });
});

export const upsertCategoryConfig = asyncHandler(async (req, res) => {
  ensureDatabaseReady();
  const hierarchy = req.body?.hierarchy;

  if (!hierarchy || typeof hierarchy !== "object" || Array.isArray(hierarchy)) {
    const error = new Error("A valid category hierarchy object is required.");
    error.statusCode = 400;
    throw error;
  }

  const existing = await CategoryConfig.findOne().sort({ updatedAt: -1 });
  if (existing) {
    existing.hierarchy = hierarchy;
    await existing.save();
    res.json({ ok: true, hierarchy: existing.hierarchy });
    return;
  }

  const created = await CategoryConfig.create({ hierarchy });
  res.status(201).json({ ok: true, hierarchy: created.hierarchy });
});
