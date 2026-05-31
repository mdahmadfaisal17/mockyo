import Mockup from "../models/mockupModel.js";
import Subscriber from "../models/subscriberModel.js";
import User from "../models/userModel.js";
import GuestDownloadTracker from "../models/guestDownloadTrackerModel.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { sendNewMockupEmail } from "../utils/email.js";
import { getR2EndpointHost, getR2ObjectFromInput, resolveR2ObjectKeyFromInput, getR2PresignedUrl } from "../utils/r2SignedUrl.js";
import crypto from "crypto";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const ensureDatabaseReady = () => {
  if (mongoose.connection.readyState !== 1) {
    const error = new Error(
      "Database is not connected. Please verify MongoDB and try again.",
    );
    error.statusCode = 503;
    throw error;
  }
};

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const sanitizeFilename = (value) => {
  return String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/[\s]+/g, " ")
    .substring(0, 200) || "download";
};

const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const toAssetItem = async (file, folder, labelPrefix) => {
  const safeName = slugify(file.originalname.replace(/\.[^.]+$/, "")) || "asset";
  const uploaded = await uploadBufferToCloudinary(
    file.buffer,
    folder,
    `${Date.now()}-${safeName}`,
  );

  return {
    label: labelPrefix || file.fieldname,
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
  };
};

const toPlainAsset = (asset, labelFallback) => {
  if (!asset?.url) return null;
  return {
    label: asset.label || labelFallback || "asset",
    url: asset.url,
    publicId: asset.publicId || "",
  };
};

const parseBlendModes = (input) => {
  if (!input) return [];
  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((mode) =>
      ["multiply", "screen", "overlay"].includes(mode) ? mode : "normal",
    );
  } catch {
    return [];
  }
};

const USER_AUTH_COOKIE = "mockyo_user_token";
const ADMIN_AUTH_COOKIE = "mockyo_admin_token";

const getTodayDownloadKey = () => new Date().toISOString().slice(0, 10);

const readCookie = (cookieHeader, key) => {
  const target = `${key}=`;
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(target))
    ?.slice(target.length) || "";
};

const getRequestIp = (req) => {
  const forwarded = String(req.headers["x-forwarded-for"] || "").trim();
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return String(req.ip || req.socket?.remoteAddress || "").trim() || "unknown";
};

const buildGuestFingerprint = (req) => {
  const ip = getRequestIp(req);
  const userAgent = String(req.headers["user-agent"] || "").trim().slice(0, 512);
  return crypto.createHash("sha256").update(`${ip}|${userAgent}`).digest("hex");
};

const enforceDailyGuestDownloadLimit = async (req) => {
  const authenticatedEmail = getAuthenticatedUserEmailFromRequest(req);
  if (authenticatedEmail) {
    return authenticatedEmail;
  }

  const today = getTodayDownloadKey();
  const fingerprint = buildGuestFingerprint(req);
  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  try {
    // Unique key guarantees only one guest download per day for the same fingerprint.
    await GuestDownloadTracker.create({ dateKey: today, fingerprint, expiresAt });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicateError = new Error("Please sign in to continue downloading.");
      duplicateError.statusCode = 401;
      throw duplicateError;
    }
    throw error;
  }

  return "";
};

const ensureGuestCanDownload = async (req) => {
  const authenticatedEmail = getAuthenticatedUserEmailFromRequest(req);
  if (authenticatedEmail) {
    return authenticatedEmail;
  }

  const today = getTodayDownloadKey();
  const fingerprint = buildGuestFingerprint(req);
  const alreadyUsed = await GuestDownloadTracker.exists({ dateKey: today, fingerprint });

  if (alreadyUsed) {
    const duplicateError = new Error("Please sign in to continue downloading.");
    duplicateError.statusCode = 401;
    throw duplicateError;
  }

  return "";
};

const isAdminRequest = (req) => {
  const authHeader = String(req.headers["authorization"] || "");
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const cookieToken = readCookie(req.headers.cookie, ADMIN_AUTH_COOKIE);
  const token = bearerToken || cookieToken;
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, String(process.env.JWT_SECRET || ""));
    return decoded?.role === "Admin";
  } catch {
    return false;
  }
};

const getAuthenticatedUserEmailFromRequest = (req) => {
  const token = readCookie(req.headers.cookie, USER_AUTH_COOKIE);
  if (!token) return "";

  const jwtSecret = String(process.env.JWT_SECRET || "");
  try {
    const decoded = jwt.verify(token, jwtSecret);
    return String(decoded?.email || "").trim().toLowerCase();
  } catch {
    return "";
  }
};

export const getMockups = asyncHandler(async (req, res) => {
  ensureDatabaseReady();
  if (isAdminRequest(req)) {
    const mockups = await Mockup.find().sort({ createdAt: -1 });
    return res.json({ ok: true, items: mockups });
  }
  const mockups = await Mockup.find({ status: "published" }).select("-objectKey").sort({ createdAt: -1 });
  res.json({ ok: true, items: mockups });
});

export const getMockupById = asyncHandler(async (req, res) => {
  ensureDatabaseReady();
  if (isAdminRequest(req)) {
    const mockup = await Mockup.findById(req.params.id);
    if (!mockup) {
      const error = new Error("Mockup not found.");
      error.statusCode = 404;
      throw error;
    }
    return res.json({ ok: true, item: mockup });
  }
  const mockup = await Mockup.findOne({ _id: req.params.id, status: "published" }).select("-objectKey");
  if (!mockup) {
    const error = new Error("Mockup not found.");
    error.statusCode = 404;
    throw error;
  }
  res.json({ ok: true, item: mockup });
});

export const createMockup = asyncHandler(async (req, res) => {
  ensureDatabaseReady();
  const {
    title,
    category,
    mainCategory = "Apparel",
    description = "",
    status = "draft",
    objectKey = "",
    downloadEnabled,
  } = req.body;

  const isDownloadEnabled = parseBoolean(downloadEnabled, true);

  if (!title || !category) {
    const error = new Error("Title and category are required.");
    error.statusCode = 400;
    throw error;
  }

  const files = req.files || {};
  const artboardLayerModes = parseBlendModes(req.body.artboardLayerModes);
  const productSlug = slugify(title) || `mockup-${Date.now()}`;
  const baseFolder = `mockyo/mockups/${productSlug}`;

  const thumbnails = await Promise.all(
    (files.thumbnails || []).map((file, index) =>
      toAssetItem(file, `${baseFolder}/thumbnails`, `thumbnail-${index + 1}`),
    ),
  );

  const uploadSingleLayer = async (key) => {
    const [file] = files[key] || [];
    if (!file) return null;
    return toAssetItem(file, `${baseFolder}/blend-layers`, key);
  };

  const uploadSingleAsset = async (fieldName, folder, label) => {
    const [file] = files[fieldName] || [];
    if (!file) return null;
    return toAssetItem(file, folder, label);
  };

  // Use artboardLayerMeta if present (preserves user names + order), else fall back to simple array
  let artboardLayers;
  if (req.body.artboardLayerMeta) {
    let meta;
    try { meta = JSON.parse(req.body.artboardLayerMeta); } catch { meta = []; }
    const uploadedFiles = files.artboardLayers || [];
    artboardLayers = await Promise.all(
      meta.map(async (entry, i) => {
        if (entry.fileIndex !== undefined) {
          const file = uploadedFiles[entry.fileIndex];
          const asset = await toAssetItem(file, `${baseFolder}/artboard-layers`, entry.label || `artboard-layer-${i + 1}`);
          return { ...asset, blendMode: entry.blendMode || "normal" };
        }
        return { label: entry.label || `artboard-layer-${i + 1}`, url: entry.url, publicId: "", blendMode: entry.blendMode || "normal" };
      }),
    );
  } else {
    artboardLayers = await Promise.all(
      (files.artboardLayers || []).map(async (file, index) => {
        const asset = await toAssetItem(file, `${baseFolder}/artboard-layers`, `artboard-layer-${index + 1}`);
        return { ...asset, blendMode: artboardLayerModes[index] || "normal" };
      }),
    );
  }

  // designAreaImages — ordered array with meta (same pattern as artboardLayers)
  let designAreaImages;
  if (req.body.designAreaImagesMeta) {
    let meta;
    try { meta = JSON.parse(req.body.designAreaImagesMeta); } catch { meta = []; }
    const uploadedFiles = files.designAreaImages || [];
    const sizeFiles = files.sizeImages || [];
    let _sizeIdx = 0;
    designAreaImages = await Promise.all(
      meta.map(async (entry, i) => {
        const base = entry.fileIndex !== undefined
          ? await toAssetItem(uploadedFiles[entry.fileIndex], `${baseFolder}/design-area-images`, entry.label || `design-area-${i + 1}`)
          : { label: entry.label || `design-area-${i + 1}`, url: entry.url, publicId: "" };
        if (entry.perspectiveCorners) base.perspectiveCorners = entry.perspectiveCorners;
        if (entry.wrapHandles) base.wrapHandles = entry.wrapHandles;
        if (entry.sizeTransform) base.sizeTransform = entry.sizeTransform;
        if (entry.sizeImageFileIndex !== undefined && sizeFiles[entry.sizeImageFileIndex]) {
          const sizeAsset = await toAssetItem(sizeFiles[entry.sizeImageFileIndex], `${baseFolder}/size-images`, `size-${i + 1}`);
          base.sizeImage = { url: sizeAsset.url, publicId: sizeAsset.publicId };
        } else if (entry.sizeImageUrl) {
          base.sizeImage = { url: entry.sizeImageUrl, publicId: "" };
        }
        return base;
      }),
    );
  } else {
    designAreaImages = await Promise.all(
      (files.designAreaImages || []).map((file, index) =>
        toAssetItem(file, `${baseFolder}/design-area-images`, `design-area-${index + 1}`),
      ),
    );
  }

  // colorAreaImages — ordered array with meta
  let colorAreaImages;
  if (req.body.colorAreaImagesMeta) {
    let meta;
    try { meta = JSON.parse(req.body.colorAreaImagesMeta); } catch { meta = []; }
    const uploadedFiles = files.colorAreaImages || [];
    colorAreaImages = await Promise.all(
      meta.map(async (entry, i) => {
        if (entry.fileIndex !== undefined) {
          const file = uploadedFiles[entry.fileIndex];
          const asset = await toAssetItem(file, `${baseFolder}/color-area-images`, entry.label || `color-area-${i + 1}`);
          return asset;
        }
        return { label: entry.label || `color-area-${i + 1}`, url: entry.url, publicId: "" };
      }),
    );
  } else {
    colorAreaImages = await Promise.all(
      (files.colorAreaImages || []).map((file, index) =>
        toAssetItem(file, `${baseFolder}/color-area-images`, `color-area-${index + 1}`),
      ),
    );
  }

  // defaultImages — ordered array with meta
  let defaultImages;
  if (req.body.defaultImagesMeta) {
    let meta;
    try { meta = JSON.parse(req.body.defaultImagesMeta); } catch { meta = []; }
    const uploadedFiles = files.defaultImages || [];
    defaultImages = await Promise.all(
      meta.map(async (entry, i) => {
        if (entry.fileIndex !== undefined) {
          const file = uploadedFiles[entry.fileIndex];
          const asset = await toAssetItem(file, `${baseFolder}/default-images`, entry.label || `default-image-${i + 1}`);
          return asset;
        }
        return { label: entry.label || `default-image-${i + 1}`, url: entry.url, publicId: "" };
      }),
    );
  } else {
    defaultImages = await Promise.all(
      (files.defaultImages || []).map((file, index) =>
        toAssetItem(file, `${baseFolder}/default-images`, `default-image-${index + 1}`),
      ),
    );
  }

  const firstArtboardLayer = artboardLayers[0] || null;
  const topNormalArtboardLayer = [...artboardLayers].reverse().find((layer) => layer.blendMode === "normal") || null;
  const firstArtboardLayerByMode = (mode) => artboardLayers.find((layer) => layer.blendMode === mode) || null;

  const [
    primaryBaseUpload,
    primaryOverlayUpload,
    frontBaseMockup,
    frontOverlayImage,
    backBaseMockup,
    backOverlayImage,
    multiplyUpload,
    screenUpload,
    overlayUpload,
    designAreaBody,
    designAreaLeftSleeve,
    designAreaRightSleeve,
    colorAreaBody,
    colorAreaSleeves,
    colorAreaCollar,
  ] = await Promise.all([
    uploadSingleAsset("primaryBaseMockup", `${baseFolder}/views/primary`, "primary-base-mockup"),
    uploadSingleAsset("primaryOverlayImage", `${baseFolder}/views/primary`, "primary-overlay-image"),
    uploadSingleAsset("frontBaseMockup", `${baseFolder}/views/front`, "front-base-mockup"),
    uploadSingleAsset("frontOverlayImage", `${baseFolder}/views/front`, "front-overlay-image"),
    uploadSingleAsset("backBaseMockup", `${baseFolder}/views/back`, "back-base-mockup"),
    uploadSingleAsset("backOverlayImage", `${baseFolder}/views/back`, "back-overlay-image"),
    uploadSingleLayer("multiply"),
    uploadSingleLayer("screen"),
    uploadSingleLayer("overlay"),
    uploadSingleAsset("designAreaBody", `${baseFolder}/design-areas`, "body"),
    uploadSingleAsset("designAreaLeftSleeve", `${baseFolder}/design-areas`, "left-sleeve"),
    uploadSingleAsset("designAreaRightSleeve", `${baseFolder}/design-areas`, "right-sleeve"),
    uploadSingleAsset("colorAreaBody", `${baseFolder}/color-areas`, "body"),
    uploadSingleAsset("colorAreaSleeves", `${baseFolder}/color-areas`, "sleeves"),
    uploadSingleAsset("colorAreaCollar", `${baseFolder}/color-areas`, "collar"),
  ]);

  const primaryBaseMockup =
    primaryBaseUpload ||
    toPlainAsset(firstArtboardLayer, "primary-base-mockup") ||
    toPlainAsset(thumbnails[0], "primary-base-mockup") ||
    null;
  const primaryOverlayImage =
    primaryOverlayUpload ||
    toPlainAsset(topNormalArtboardLayer, "primary-overlay-image") ||
    null;
  const multiply = multiplyUpload || toPlainAsset(firstArtboardLayerByMode("multiply"), "multiply");
  const screen = screenUpload || toPlainAsset(firstArtboardLayerByMode("screen"), "screen");
  const overlay = overlayUpload || toPlainAsset(firstArtboardLayerByMode("overlay"), "overlay");

  const mockup = await Mockup.create({
    title,
    category,
    mainCategory,
    description,
    status,
    objectKey,
    downloadEnabled: isDownloadEnabled,
    thumbnails,
    artboardLayers,
    designAreaImages,
    colorAreaImages,
    defaultImages,
    views: {
      primary: {
        baseMockup: primaryBaseMockup,
        overlayImage: primaryOverlayImage,
      },
      front: {
        baseMockup: frontBaseMockup,
        overlayImage: frontOverlayImage,
      },
      back: {
        baseMockup: backBaseMockup,
        overlayImage: backOverlayImage,
      },
    },
    blendLayers: { multiply, screen, overlay },
    designAreas: {
      body: designAreaBody,
      leftSleeve: designAreaLeftSleeve,
      rightSleeve: designAreaRightSleeve,
    },
    colorAreas: {
      body: colorAreaBody,
      sleeves: colorAreaSleeves,
      collar: colorAreaCollar,
    },
  });

  res.status(201).json({ ok: true, item: mockup });

  // Notify subscribers in background — do not block response
  const frontendUrl = String(process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim();
  const mockupUrl = `${frontendUrl}/mockups/${mockup._id}`;
  const thumbnailUrl = mockup.thumbnails?.[0]?.url || null;

  Subscriber.find({}).then((subscribers) => {
    console.log(`[Notify] Found ${subscribers.length} subscribers to notify.`);
    subscribers.forEach((sub) => {
      sendNewMockupEmail({
        to: sub.email,
        mockupTitle: mockup.title,
        mockupUrl,
        thumbnailUrl,
      }).catch((err) => { console.error(`[Notify] Failed to email ${sub.email}:`, err.message); });
    });
  }).catch((err) => { console.error("[Notify] Failed to fetch subscribers:", err.message); });
});

export const updateMockup = asyncHandler(async (req, res) => {
  ensureDatabaseReady();
  const {
    title,
    category,
    mainCategory = "Apparel",
    description = "",
    status = "draft",
    objectKey = "",
    downloadEnabled,
  } = req.body;

  if (!title || !category) {
    const error = new Error("Title and category are required.");
    error.statusCode = 400;
    throw error;
  }

  const mockup = await Mockup.findById(req.params.id);
  if (!mockup) {
    const error = new Error("Mockup not found.");
    error.statusCode = 404;
    throw error;
  }

  const isDownloadEnabled = parseBoolean(downloadEnabled, mockup.downloadEnabled ?? true);

  const files = req.files || {};
  const artboardLayerModes = parseBlendModes(req.body.artboardLayerModes);
  const productSlug = slugify(title) || `mockup-${Date.now()}`;
  const baseFolder = `mockyo/mockups/${productSlug}`;

  const uploadSingleLayer = async (key) => {
    const [file] = files[key] || [];
    if (!file) return null;
    return toAssetItem(file, `${baseFolder}/blend-layers`, key);
  };

  const uploadSingleAsset = async (fieldName, folder, label) => {
    const [file] = files[fieldName] || [];
    if (!file) return null;
    return toAssetItem(file, folder, label);
  };

  const nextThumbnails = (files.thumbnails || []).length
    ? await Promise.all(
        (files.thumbnails || []).map((file, index) =>
          toAssetItem(file, `${baseFolder}/thumbnails`, `thumbnail-${index + 1}`),
        ),
      )
    : mockup.thumbnails;

  // artboardLayerMeta is the source of truth when present (handles removals/reorders)
  let nextArtboardLayers;
  if (req.body.artboardLayerMeta) {
    let meta;
    try { meta = JSON.parse(req.body.artboardLayerMeta); } catch { meta = []; }
    const uploadedFiles = files.artboardLayers || [];
    nextArtboardLayers = await Promise.all(
      meta.map(async (entry, i) => {
        if (entry.fileIndex !== undefined) {
          const file = uploadedFiles[entry.fileIndex];
          const asset = await toAssetItem(file, `${baseFolder}/artboard-layers`, entry.label || `artboard-layer-${i + 1}`);
          return { ...asset, blendMode: entry.blendMode || "normal" };
        }
        return {
          label: entry.label || `artboard-layer-${i + 1}`,
          url: entry.url,
          publicId: "",
          blendMode: entry.blendMode || "normal",
        };
      }),
    );
  } else if ((files.artboardLayers || []).length) {
    nextArtboardLayers = await Promise.all(
      (files.artboardLayers || []).map(async (file, index) => {
        const asset = await toAssetItem(file, `${baseFolder}/artboard-layers`, `artboard-layer-${index + 1}`);
        return { ...asset, blendMode: artboardLayerModes[index] || "normal" };
      }),
    );
  } else {
    nextArtboardLayers = mockup.artboardLayers;
  }

  const hasNewArtboardLayers = (files.artboardLayers || []).length > 0;
  const hasNewThumbnails = (files.thumbnails || []).length > 0;
  const firstArtboardLayer = nextArtboardLayers[0] || null;
  const topNormalArtboardLayer = [...nextArtboardLayers].reverse().find((layer) => layer.blendMode === "normal") || null;
  const firstArtboardLayerByMode = (mode) => nextArtboardLayers.find((layer) => layer.blendMode === mode) || null;

  const [
    primaryBaseUpload,
    primaryOverlayUpload,
    frontBaseUpload,
    frontOverlayUpload,
    backBaseUpload,
    backOverlayUpload,
    multiplyUpload,
    screenUpload,
    overlayUpload,
  ] = await Promise.all([
    uploadSingleAsset("primaryBaseMockup", `${baseFolder}/views/primary`, "primary-base-mockup"),
    uploadSingleAsset("primaryOverlayImage", `${baseFolder}/views/primary`, "primary-overlay-image"),
    uploadSingleAsset("frontBaseMockup", `${baseFolder}/views/front`, "front-base-mockup"),
    uploadSingleAsset("frontOverlayImage", `${baseFolder}/views/front`, "front-overlay-image"),
    uploadSingleAsset("backBaseMockup", `${baseFolder}/views/back`, "back-base-mockup"),
    uploadSingleAsset("backOverlayImage", `${baseFolder}/views/back`, "back-overlay-image"),
    uploadSingleLayer("multiply"),
    uploadSingleLayer("screen"),
    uploadSingleLayer("overlay"),
  ]);

  const primaryBaseMockup =
    primaryBaseUpload ||
    (hasNewArtboardLayers || hasNewThumbnails
      ? toPlainAsset(firstArtboardLayer, "primary-base-mockup") || toPlainAsset(nextThumbnails[0], "primary-base-mockup")
      : null) ||
    mockup.views?.primary?.baseMockup ||
    null;
  const primaryOverlayImage =
    primaryOverlayUpload ||
    (hasNewArtboardLayers ? toPlainAsset(topNormalArtboardLayer, "primary-overlay-image") : null) ||
    mockup.views?.primary?.overlayImage ||
    null;
  const frontBaseMockup = frontBaseUpload || mockup.views?.front?.baseMockup || null;
  const frontOverlayImage = frontOverlayUpload || mockup.views?.front?.overlayImage || null;
  const backBaseMockup = backBaseUpload || mockup.views?.back?.baseMockup || null;
  const backOverlayImage = backOverlayUpload || mockup.views?.back?.overlayImage || null;
  const multiply =
    multiplyUpload ||
    (hasNewArtboardLayers ? toPlainAsset(firstArtboardLayerByMode("multiply"), "multiply") : null) ||
    mockup.blendLayers?.multiply ||
    null;
  const screen =
    screenUpload ||
    (hasNewArtboardLayers ? toPlainAsset(firstArtboardLayerByMode("screen"), "screen") : null) ||
    mockup.blendLayers?.screen ||
    null;
  const overlay =
    overlayUpload ||
    (hasNewArtboardLayers ? toPlainAsset(firstArtboardLayerByMode("overlay"), "overlay") : null) ||
    mockup.blendLayers?.overlay ||
    null;

  // designAreaImages for update
  let nextDesignAreaImages;
  if (req.body.designAreaImagesMeta) {
    let meta;
    try { meta = JSON.parse(req.body.designAreaImagesMeta); } catch { meta = []; }
    const uploadedFiles = files.designAreaImages || [];
    const sizeFiles = files.sizeImages || [];
    nextDesignAreaImages = await Promise.all(
      meta.map(async (entry, i) => {
        const base = entry.fileIndex !== undefined
          ? await toAssetItem(uploadedFiles[entry.fileIndex], `${baseFolder}/design-area-images`, entry.label || `design-area-${i + 1}`)
          : { label: entry.label || `design-area-${i + 1}`, url: entry.url, publicId: "" };
        if (entry.perspectiveCorners) base.perspectiveCorners = entry.perspectiveCorners;
        if (entry.wrapHandles) base.wrapHandles = entry.wrapHandles;
        if (entry.sizeTransform) base.sizeTransform = entry.sizeTransform;
        if (entry.sizeImageFileIndex !== undefined && sizeFiles[entry.sizeImageFileIndex]) {
          const sizeAsset = await toAssetItem(sizeFiles[entry.sizeImageFileIndex], `${baseFolder}/size-images`, `size-${i + 1}`);
          base.sizeImage = { url: sizeAsset.url, publicId: sizeAsset.publicId };
        } else if (entry.sizeImageUrl) {
          base.sizeImage = { url: entry.sizeImageUrl, publicId: "" };
        }
        return base;
      }),
    );
  } else if ((files.designAreaImages || []).length) {
    nextDesignAreaImages = await Promise.all(
      (files.designAreaImages || []).map((file, index) =>
        toAssetItem(file, `${baseFolder}/design-area-images`, `design-area-${index + 1}`),
      ),
    );
  } else {
    nextDesignAreaImages = mockup.designAreaImages || [];
  }

  // colorAreaImages for update
  let nextColorAreaImages;
  if (req.body.colorAreaImagesMeta) {
    let meta;
    try { meta = JSON.parse(req.body.colorAreaImagesMeta); } catch { meta = []; }
    const uploadedFiles = files.colorAreaImages || [];
    nextColorAreaImages = await Promise.all(
      meta.map(async (entry, i) => {
        if (entry.fileIndex !== undefined) {
          const file = uploadedFiles[entry.fileIndex];
          const asset = await toAssetItem(file, `${baseFolder}/color-area-images`, entry.label || `color-area-${i + 1}`);
          return asset;
        }
        return { label: entry.label || `color-area-${i + 1}`, url: entry.url, publicId: "" };
      }),
    );
  } else if ((files.colorAreaImages || []).length) {
    nextColorAreaImages = await Promise.all(
      (files.colorAreaImages || []).map((file, index) =>
        toAssetItem(file, `${baseFolder}/color-area-images`, `color-area-${index + 1}`),
      ),
    );
  } else {
    nextColorAreaImages = mockup.colorAreaImages || [];
  }

  // defaultImages for update
  let nextDefaultImages;
  if (req.body.defaultImagesMeta) {
    let meta;
    try { meta = JSON.parse(req.body.defaultImagesMeta); } catch { meta = []; }
    const uploadedFiles = files.defaultImages || [];
    nextDefaultImages = await Promise.all(
      meta.map(async (entry, i) => {
        if (entry.fileIndex !== undefined) {
          const file = uploadedFiles[entry.fileIndex];
          const asset = await toAssetItem(file, `${baseFolder}/default-images`, entry.label || `default-image-${i + 1}`);
          return asset;
        }
        return { label: entry.label || `default-image-${i + 1}`, url: entry.url, publicId: "" };
      }),
    );
  } else if ((files.defaultImages || []).length) {
    nextDefaultImages = await Promise.all(
      (files.defaultImages || []).map((file, index) =>
        toAssetItem(file, `${baseFolder}/default-images`, `default-image-${index + 1}`),
      ),
    );
  } else {
    nextDefaultImages = mockup.defaultImages || [];
  }

  const designAreaBody =
    (await uploadSingleAsset("designAreaBody", `${baseFolder}/design-areas`, "body")) ||
    mockup.designAreas?.body ||
    null;
  const designAreaLeftSleeve =
    (await uploadSingleAsset("designAreaLeftSleeve", `${baseFolder}/design-areas`, "left-sleeve")) ||
    mockup.designAreas?.leftSleeve ||
    null;
  const designAreaRightSleeve =
    (await uploadSingleAsset("designAreaRightSleeve", `${baseFolder}/design-areas`, "right-sleeve")) ||
    mockup.designAreas?.rightSleeve ||
    null;

  const colorAreaBody =
    (await uploadSingleAsset("colorAreaBody", `${baseFolder}/color-areas`, "body")) ||
    mockup.colorAreas?.body ||
    null;
  const colorAreaSleeves =
    (await uploadSingleAsset("colorAreaSleeves", `${baseFolder}/color-areas`, "sleeves")) ||
    mockup.colorAreas?.sleeves ||
    null;
  const colorAreaCollar =
    (await uploadSingleAsset("colorAreaCollar", `${baseFolder}/color-areas`, "collar")) ||
    mockup.colorAreas?.collar ||
    null;

  mockup.title = title;
  mockup.category = category;
  mockup.mainCategory = mainCategory;
  mockup.description = description;
  mockup.status = status;
  mockup.objectKey = objectKey;
  mockup.downloadEnabled = isDownloadEnabled;
  mockup.thumbnails = nextThumbnails;
  mockup.artboardLayers = nextArtboardLayers;
  mockup.designAreaImages = nextDesignAreaImages;
  mockup.colorAreaImages = nextColorAreaImages;
  mockup.defaultImages = nextDefaultImages;
  mockup.views = {
    primary: {
      baseMockup: primaryBaseMockup,
      overlayImage: primaryOverlayImage,
    },
    front: {
      baseMockup: frontBaseMockup,
      overlayImage: frontOverlayImage,
    },
    back: {
      baseMockup: backBaseMockup,
      overlayImage: backOverlayImage,
    },
  };
  mockup.blendLayers = { multiply, screen, overlay };
  mockup.designAreas = {
    body: designAreaBody,
    leftSleeve: designAreaLeftSleeve,
    rightSleeve: designAreaRightSleeve,
  };
  mockup.colorAreas = {
    body: colorAreaBody,
    sleeves: colorAreaSleeves,
    collar: colorAreaCollar,
  };

  await mockup.save();
  res.json({ ok: true, item: mockup });
});

export const deleteMockup = asyncHandler(async (req, res) => {
  ensureDatabaseReady();
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("Invalid mockup id.");
    error.statusCode = 400;
    throw error;
  }

  const deleted = await Mockup.findByIdAndDelete(id).lean();

  if (!deleted) {
    const error = new Error("Mockup not found.");
    error.statusCode = 404;
    throw error;
  }

  res.json({ ok: true, message: "Mockup deleted successfully." });
});

export const getDownloadPresignedUrl = asyncHandler(async (req, res) => {
  const { mockupId } = req.query;

  if (!(typeof mockupId === "string" && mongoose.Types.ObjectId.isValid(mockupId))) {
    const error = new Error("Mockup id is required.");
    error.statusCode = 400;
    throw error;
  }

  ensureDatabaseReady();
  const mockup = await Mockup.findById(mockupId).select("title objectKey downloadEnabled").lean();
  
  if (!mockup) {
    const error = new Error("Mockup not found.");
    error.statusCode = 404;
    throw error;
  }

  if (mockup.downloadEnabled === false) {
    const error = new Error("Download is disabled for this product.");
    error.statusCode = 403;
    throw error;
  }

  const authenticatedEmail = await enforceDailyGuestDownloadLimit(req);

  const objectKey = String(mockup.objectKey || "").trim();
  if (!objectKey) {
    const error = new Error("No object key configured for this mockup.");
    error.statusCode = 400;
    throw error;
  }

  try {
    const fileName = `${sanitizeFilename(mockup.title)}.psd`;
    const presignedData = await getR2PresignedUrl(objectKey, fileName);
    if (!presignedData) {
      const error = new Error("Failed to generate download URL.");
      error.statusCode = 502;
      throw error;
    }

    // Increment download count
    await Mockup.findByIdAndUpdate(mockupId, { $inc: { downloads: 1 } });

    // Track user download if authenticated
    if (authenticatedEmail) {
      let pTitle = String(mockup.title || "").trim();
      let userRecord = await User.findOne({ email: authenticatedEmail }).lean();
      if (!userRecord) {
        userRecord = await User.create({
          email: authenticatedEmail,
          mockupsDownloaded: [{ mockupTitle: pTitle, mockupId }],
        });
      } else {
        await User.findByIdAndUpdate(userRecord._id, {
          $push: { mockupsDownloaded: { mockupTitle: pTitle, mockupId } },
        });
      }
    }

    res.json({
      ok: true,
      url: presignedData.url,
      fileName: presignedData.fileName,
    });
  } catch (error) {
    console.error("Presigned URL generation error:", error);
    const statusCode = error.statusCode || 500;
    const message = statusCode >= 500
      ? "Failed to generate presigned URL."
      : (error.message || "Failed to generate presigned URL.");
    res.status(statusCode).json({ ok: false, message });
  }
});

export const downloadFile = asyncHandler(async (req, res) => {
  const { mockupId } = req.query;

  if (!(typeof mockupId === "string" && mongoose.Types.ObjectId.isValid(mockupId))) {
    const error = new Error("Mockup id is required.");
    error.statusCode = 400;
    throw error;
  }

  let mockupForDownload = null;
  let downloadSource = "";

  ensureDatabaseReady();
  mockupForDownload = await Mockup.findById(mockupId).select("title objectKey").lean();
  if (!mockupForDownload) {
    const error = new Error("Mockup not found.");
    error.statusCode = 404;
    throw error;
  }

  downloadSource = String(mockupForDownload.objectKey || "").trim();
  if (!downloadSource) {
    const error = new Error("No object key configured for this mockup.");
    error.statusCode = 400;
    throw error;
  }

  const authenticatedEmail = await enforceDailyGuestDownloadLimit(req);

  let sourceUrl = downloadSource;

  // Check if the URL points to R2 — if so, stream directly via SDK (presigned URLs
  // are not supported by all R2 API token types, so we proxy through the backend).
  const r2ObjectKey = resolveR2ObjectKeyFromInput(sourceUrl);
  const isR2Url = r2ObjectKey.length > 0;

  if (isR2Url) {
    // Stream directly from R2 via the S3 SDK.
    let r2Object;
    try {
      r2Object = await getR2ObjectFromInput(sourceUrl);
    } catch (e) {
      const error = new Error("Failed to fetch file from source.");
      error.statusCode = 502;
      throw error;
    }
    if (!r2Object) {
      const error = new Error("Failed to fetch file from source.");
      error.statusCode = 502;
      throw error;
    }

    // Count downloads and update user record.
    if (typeof mockupId === "string" && mongoose.Types.ObjectId.isValid(mockupId)) {
      await Mockup.findByIdAndUpdate(mockupId, { $inc: { downloads: 1 } });
    }
    if (authenticatedEmail) {
      let pTitle = typeof req.query.productTitle === "string" ? req.query.productTitle.trim() : "";
      const mId = typeof mockupId === "string" ? mockupId.trim() : "";
      if (!pTitle && mockupForDownload?.title) pTitle = String(mockupForDownload.title || "").trim();
      if (!pTitle && mongoose.Types.ObjectId.isValid(mId)) {
        const mockup = await Mockup.findById(mId).select("title").lean();
        pTitle = typeof mockup?.title === "string" ? mockup.title.trim() : "";
      }
      if (!pTitle) pTitle = "Unknown";
      await User.findOneAndUpdate(
        { email: authenticatedEmail },
        { $inc: { totalDownloads: 1 }, $push: { downloads: { mockupId: mId, productTitle: pTitle, downloadedAt: new Date() } } },
      );
    }

    const safeFilename = `${sanitizeFilename(mockupForDownload.title)}.psd`;
    res.setHeader("Content-Type", r2Object.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
    if (r2Object.contentLength !== null) res.setHeader("Content-Length", r2Object.contentLength);

    const { Readable } = await import("stream");
    const nodeStream = r2Object.stream instanceof Readable
      ? r2Object.stream
      : Readable.fromWeb(r2Object.stream);
    nodeStream.pipe(res);
    return;
  }

  // Non-R2 URL: SSRF protection — only allow downloads from trusted CDN hostnames.
  const r2EndpointHost = getR2EndpointHost();
  const ALLOWED_HOSTS = [
    "res.cloudinary.com",
    "dl.dropboxusercontent.com",
    "drive.google.com",
    "pub-82a3aaf014cd484594c56a27e0776a63.r2.dev",
    ...(r2EndpointHost ? [r2EndpointHost] : []),
  ];

  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    const error = new Error("Invalid download URL.");
    error.statusCode = 400;
    throw error;
  }
  if (!ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
    const error = new Error("Download URL is not from an allowed source.");
    error.statusCode = 400;
    throw error;
  }

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      const error = new Error("Failed to fetch file from source.");
      error.statusCode = response.status;
      throw error;
    }

    // Count only successful downloads and only when a valid product id is provided.
    if (typeof mockupId === "string" && mongoose.Types.ObjectId.isValid(mockupId)) {
      await Mockup.findByIdAndUpdate(mockupId, { $inc: { downloads: 1 } });
    }

    // Increment signed-in user's download counter (best effort).
    const authenticatedEmail = getAuthenticatedUserEmailFromRequest(req);
    if (authenticatedEmail) {
      let pTitle = typeof req.query.productTitle === "string" ? req.query.productTitle.trim() : "";
      const mId = typeof mockupId === "string" ? mockupId.trim() : "";
      if (!pTitle && mockupForDownload?.title) {
        pTitle = String(mockupForDownload.title || "").trim();
      }
      if (!pTitle && mongoose.Types.ObjectId.isValid(mId)) {
        const mockup = await Mockup.findById(mId).select("title").lean();
        pTitle = typeof mockup?.title === "string" ? mockup.title.trim() : "";
      }
      if (!pTitle) {
        pTitle = "Unknown";
      }
      await User.findOneAndUpdate(
        { email: authenticatedEmail },
        {
          $inc: { totalDownloads: 1 },
          $push: { downloads: { mockupId: mId, productTitle: pTitle, downloadedAt: new Date() } },
        },
      );
    }

    // Extract and sanitize filename from URL to prevent header injection.
    const rawFilename = decodeURIComponent(parsedUrl.pathname.split('/').pop() || 'download');
    const safeFilename = rawFilename.replace(/[^\w.\-]/g, "_") || "download";

    // Set response headers for download
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Length', response.headers.get('content-length') || '');

    // Stream the file directly
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Download error:", error);
    const err = new Error(error instanceof Error ? error.message : "Download failed.");
    err.statusCode = (error && typeof error === 'object' && 'statusCode' in error) ? error.statusCode : 500;
    throw err;
  }
});

export const authorizeMockupDownload = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("Invalid mockup id.");
    error.statusCode = 400;
    throw error;
  }

  ensureDatabaseReady();
  const mockup = await Mockup.findById(id).select("title downloadEnabled").lean();

  if (!mockup) {
    const error = new Error("Mockup not found.");
    error.statusCode = 404;
    throw error;
  }

  if (mockup.downloadEnabled === false) {
    const error = new Error("Download is disabled for this product.");
    error.statusCode = 403;
    throw error;
  }

  await ensureGuestCanDownload(req);

  res.json({ ok: true });
});

export const confirmMockupDownload = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("Invalid mockup id.");
    error.statusCode = 400;
    throw error;
  }

  ensureDatabaseReady();
  const mockup = await Mockup.findById(id).select("title downloadEnabled").lean();

  if (!mockup) {
    const error = new Error("Mockup not found.");
    error.statusCode = 404;
    throw error;
  }

  if (mockup.downloadEnabled === false) {
    const error = new Error("Download is disabled for this product.");
    error.statusCode = 403;
    throw error;
  }

  const authenticatedEmail = await enforceDailyGuestDownloadLimit(req);

  const updated = await Mockup.findByIdAndUpdate(
    id,
    { $inc: { downloads: 1 } },
    { new: true, select: "downloads" },
  );

  if (!updated) {
    const error = new Error("Mockup not found.");
    error.statusCode = 404;
    throw error;
  }

  if (authenticatedEmail) {
    const pTitle = String(mockup.title || "").trim() || "Unknown";
    await User.findOneAndUpdate(
      { email: authenticatedEmail },
      {
        $inc: { totalDownloads: 1 },
        $push: { downloads: { mockupId: id, productTitle: pTitle, downloadedAt: new Date() } },
      },
    );
  }

  res.json({ ok: true, downloads: updated.downloads });
});

export const incrementMockupDownloads = confirmMockupDownload;
