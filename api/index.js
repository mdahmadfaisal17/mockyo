import app from "../backend/src/app.js";
import connectDatabase from "../backend/src/config/db.js";
import { connectCloudinary } from "../backend/src/config/cloudinary.js";

let readyPromise;

const assertSecurityConfiguration = () => {
  const jwtSecret = String(process.env.JWT_SECRET || "");
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is missing.");
  }

  if (process.env.NODE_ENV === "production" && jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production.");
  }

  const gaEmail = String(process.env.GA4_CLIENT_EMAIL || "").trim();
  const gaKey = String(process.env.GA4_PRIVATE_KEY || "").trim();
  if ((gaEmail && !gaKey) || (!gaEmail && gaKey)) {
    throw new Error("GA4 credentials are partially configured. Set both GA4_CLIENT_EMAIL and GA4_PRIVATE_KEY.");
  }
};

const prepareBackend = async () => {
  if (!readyPromise) {
    readyPromise = (async () => {
      assertSecurityConfiguration();
      connectCloudinary();
      await connectDatabase();
    })();
  }

  return readyPromise;
};

export default async function handler(req, res) {
  try {
    await prepareBackend();
    return app(req, res);
  } catch (error) {
    console.error("Failed to prepare backend:", error);
    return res.status(500).json({
      ok: false,
      message: "Backend configuration error.",
    });
  }
}
