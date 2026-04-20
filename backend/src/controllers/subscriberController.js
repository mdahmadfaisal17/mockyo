import Subscriber from "../models/subscriberModel.js";
import asyncHandler from "../utils/asyncHandler.js";

const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const subscribe = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email || !isValidEmail(email)) {
    const error = new Error("A valid email address is required.");
    error.statusCode = 400;
    throw error;
  }

  const existing = await Subscriber.findOne({ email });
  if (existing) {
    // Return success silently — don't reveal whether email already exists
    return res.json({ ok: true, message: "You are now subscribed to Mockyo updates." });
  }

  await Subscriber.create({ email });
  res.json({ ok: true, message: "You are now subscribed to Mockyo updates." });
});

export const getSubscribers = asyncHandler(async (_req, res) => {
  const subscribers = await Subscriber.find().sort({ createdAt: -1 });
  res.json({ ok: true, items: subscribers });
});

export const deleteSubscriber = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const subscriber = await Subscriber.findByIdAndDelete(id);
  if (!subscriber) {
    const error = new Error("Subscriber not found.");
    error.statusCode = 404;
    throw error;
  }
  res.json({ ok: true, message: "Subscriber removed." });
});
