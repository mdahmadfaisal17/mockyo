import mongoose from "mongoose";

const guestDownloadTrackerSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true, trim: true },
    fingerprint: { type: String, required: true, trim: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

guestDownloadTrackerSchema.index({ dateKey: 1, fingerprint: 1 }, { unique: true });

const GuestDownloadTracker = mongoose.model("GuestDownloadTracker", guestDownloadTrackerSchema);

export default GuestDownloadTracker;
