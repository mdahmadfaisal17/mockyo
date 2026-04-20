import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import mockupRoutes from "./routes/mockupRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import subscriberRoutes from "./routes/subscriberRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import categoryConfigRoutes from "./routes/categoryConfigRoutes.js";
import Mockup from "./models/mockupModel.js";
import errorHandler from "./middlewares/errorHandler.js";

const app = express();

const normalizeOrigin = (value) => String(value || "").trim().replace(/\/+$/, "").toLowerCase();
const localDevOriginPattern = /^https?:\/\/(?:(?:localhost|127(?:\.\d{1,3}){3})|(?:10(?:\.\d{1,3}){3})|(?:192\.168(?:\.\d{1,3}){2})|(?:172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}))(?::\d+)?$/;
const isAllowedLocalDevOrigin = (origin) =>
  process.env.NODE_ENV !== "production" && localDevOriginPattern.test(normalizeOrigin(origin));

app.use(helmet());

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
    const isSecure = req.secure || forwardedProto === "https";
    if (isSecure) {
      next();
      return;
    }

    if (String(req.method || "").toUpperCase() === "GET") {
      const host = String(req.headers.host || "");
      const location = `https://${host}${req.originalUrl || req.url || "/"}`;
      res.redirect(301, location);
      return;
    }

    res.status(400).json({ ok: false, message: "HTTPS is required." });
  });
}

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

if (!allowedOrigins.includes(normalizeOrigin("http://localhost:5174"))) {
  allowedOrigins.push(normalizeOrigin("http://localhost:5174"));
}

app.use(
  cors({
    origin(origin, callback) {
      const normalizedOrigin = normalizeOrigin(origin);
      // Allow requests from configured frontend origins and non-browser clients.
      if (!origin || allowedOrigins.includes(normalizedOrigin) || isAllowedLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Too many requests. Please try again later." },
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    message: "Mockyo backend is running.",
    databaseConnected: mongoose.connection.readyState === 1,
  });
});

const xmlEscape = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");

app.get("/sitemap.xml", async (_req, res) => {
  const siteUrl = String(
    process.env.SITE_URL || process.env.CLIENT_URL?.split(",")?.[0] || "https://mockyo.com",
  )
    .trim()
    .replace(/\/+$/, "");

  const staticUrls = [
    { path: "/", changefreq: "weekly", priority: "1.0" },
    { path: "/mockups", changefreq: "daily", priority: "0.9" },
    { path: "/contact", changefreq: "monthly", priority: "0.5" },
    { path: "/reviews", changefreq: "weekly", priority: "0.6" },
    { path: "/help-center", changefreq: "monthly", priority: "0.5" },
    { path: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
    { path: "/terms-conditions", changefreq: "yearly", priority: "0.3" },
  ];

  let productUrls = [];
  try {
    const mockups = await Mockup.find({ status: "published" })
      .select("_id updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    productUrls = mockups.map((item) => ({
      path: `/mockups/${item._id}`,
      changefreq: "weekly",
      priority: "0.8",
      lastmod: item.updatedAt ? new Date(item.updatedAt).toISOString().slice(0, 10) : undefined,
    }));
  } catch {
    productUrls = [];
  }

  const urls = [...staticUrls, ...productUrls]
    .map((item) => {
      const loc = `${siteUrl}${item.path}`;
      const lastmodXml = item.lastmod ? `\n    <lastmod>${xmlEscape(item.lastmod)}</lastmod>` : "";
      return `  <url>\n    <loc>${xmlEscape(loc)}</loc>${lastmodXml}\n    <changefreq>${xmlEscape(item.changefreq)}</changefreq>\n    <priority>${xmlEscape(item.priority)}</priority>\n  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

  res.set("Content-Type", "application/xml; charset=utf-8");
  res.status(200).send(xml);
});

app.use("/api/mockups", mockupRoutes);
app.use("/api/auth", authRateLimit, authRoutes);
app.use("/api/subscribers", subscriberRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/categories", categoryConfigRoutes);
app.use(errorHandler);

export default app;
