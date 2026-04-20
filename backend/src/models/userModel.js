import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: {
      type: String,
      required() {
        return this.authProvider === "local";
      },
    },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    googleId: { type: String, unique: true, sparse: true },
    avatar: { type: String, default: "" },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, default: "" },
    emailVerificationExpiresAt: { type: Date, default: null },
    passwordResetTokenHash: { type: String, default: "" },
    passwordResetExpiresAt: { type: Date, default: null },
    changePasswordOtpHash: { type: String, default: "" },
    changePasswordOtpExpiresAt: { type: Date, default: null },
    changePasswordOtpAttempts: { type: Number, default: 0, min: 0 },
    changePasswordOtpCooldownUntil: { type: Date, default: null },
    role: { type: String, enum: ["User", "Admin"], default: "User" },
    status: { type: String, enum: ["Active", "Banned"], default: "Active" },
    totalDownloads: { type: Number, default: 0, min: 0 },
    downloads: [
      {
        mockupId: { type: String, default: "" },
        productTitle: { type: String, default: "Unknown" },
        downloadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

export default User;
