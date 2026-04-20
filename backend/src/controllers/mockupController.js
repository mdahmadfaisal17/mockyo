import Mockup from "../models/mockupModel.js";
import Subscriber from "../models/subscriberModel.js";
import User from "../models/userModel.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";
import { sendNewMockupEmail } from "../utils/email.js";
import { getR2EndpointHost, getR2ObjectFromInput, resolveR2ObjectKeyFromInput, getR2PresignedUrl } from "../utils/r2SignedUrl.js";
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

const readCookie = (cookieHeader, key) => {
  const target = `${key}=`;
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(target))
    ?.slice(target.length) || "";
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

export const getMockups = asyncHandler(async (_req, res) => {
  ensureDatabaseReady();
  const mockups = await Mockup.find().sort({ createdAt: -1 });
  res.json({ ok: true, items: mockups });
});

export const getMockupById = asyncHandler(async (req, res) => {
  ensureDatabaseReady();
  const mockup = await Mockup.findById(req.params.id);

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
  } = req.body;

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

  const mockup = await Mockup.create({
    title,
    category,
    mainCategory,
    description,
    status,
    objectKey,
    thumbnails,
    artboardLayers,
    designAreaImages,
    colorAreaImages,
    defaultImages,
    views: {
      primary: {
        baseMockup: await uploadSingleAsset(
          "primaryBaseMockup",
          `${baseFolder}/views/primary`,
          "primary-base-mockup",
        ),
        overlayImage: await uploadSingleAsset(
          "primaryOverlayImage",
          `${baseFolder}/views/primary`,
          "primary-overlay-image",
        ),
      },
      front: {
        baseMockup: await uploadSingleAsset(
          "frontBaseMockup",
          `${baseFolder}/views/front`,
          "front-base-mockup",
        ),
        overlayImage: await uploadSingleAsset(
          "frontOverlayImage",
          `${baseFolder}/views/front`,
          "front-overlay-image",
        ),
      },
      back: {
        baseMockup: await uploadSingleAsset(
          "backBaseMockup",
          `${baseFolder}/views/back`,
          "back-base-mockup",
        ),
        overlayImage: await uploadSingleAsset(
          "backOverlayImage",
          `${baseFolder}/views/back`,
          "back-overlay-image",
        ),
      },
    },
    blendLayers: {
      multiply: await uploadSingleLayer("multiply"),
      screen: await uploadSingleLayer("screen"),
      overlay: await uploadSingleLayer("overlay"),
    },
    designAreas: {
      body: await uploadSingleAsset(
        "designAreaBody",
        `${baseFolder}/design-areas`,
        "body",
      ),
      leftSleeve: await uploadSingleAsset(
        "designAreaLeftSleeve",
        `${baseFolder}/design-areas`,
        "left-sleeve",
      ),
      rightSleeve: await uploadSingleAsset(
        "designAreaRightSleeve",
        `${baseFolder}/design-areas`,
        "right-sleeve",
      ),
    },
    colorAreas: {
      body: await uploadSingleAsset(
        "colorAreaBody",
        `${baseFolder}/color-areas`,
        "body",
      ),
      sleeves: await uploadSingleAsset(
        "colorAreaSleeves",
        `${baseFolder}/color-areas`,
        "sleeves",
      ),
      collar: await uploadSingleAsset(
        "colorAreaCollar",
        `${baseFolder}/color-areas`,
        "collar",
      ),
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

  const primaryBaseMockup =
    (await uploadSingleAsset("primaryBaseMockup", `${baseFolder}/views/primary`, "primary-base-mockup")) ||
    mockup.views?.primary?.baseMockup ||
    null;
  const primaryOverlayImage =
    (await uploadSingleAsset("primaryOverlayImage", `${baseFolder}/views/primary`, "primary-overlay-image")) ||
    mockup.views?.primary?.overlayImage ||
    null;
  const frontBaseMockup =
    (await uploadSingleAsset("frontBaseMockup", `${baseFolder}/views/front`, "front-base-mockup")) ||
    mockup.views?.front?.baseMockup ||
    null;
  const frontOverlayImage =
    (await uploadSingleAsset("frontOverlayImage", `${baseFolder}/views/front`, "front-overlay-image")) ||
    mockup.views?.front?.overlayImage ||
    null;
  const backBaseMockup =
    (await uploadSingleAsset("backBaseMockup", `${baseFolder}/views/back`, "back-base-mockup")) ||
    mockup.views?.back?.baseMockup ||
    null;
  const backOverlayImage =
    (await uploadSingleAsset("backOverlayImage", `${baseFolder}/views/back`, "back-overlay-image")) ||
    mockup.views?.back?.overlayImage ||
    null;

  const multiply = (await uploadSingleLayer("multiply")) || mockup.blendLayers?.multiply || null;
  const screen = (await uploadSingleLayer("screen")) || mockup.blendLayers?.screen || null;
  const overlay = (await uploadSingleLayer("overlay")) || mockup.blendLayers?.overlay || null;

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
  const mockup = await Mockup.findById(mockupId).select("title objectKey").lean();
  
  if (!mockup) {
    const error = new Error("Mockup not found.");
    error.statusCode = 404;
    throw error;
  }

  const objectKey = String(mockup.objectKey || "").trim();
  if (!objectKey) {
    const error = new Error("No object key configured for this mockup.");
    error.statusCode = 400;
    throw error;
  }

  try {
    const presignedData = await getR2PresignedUrl(objectKey, mockup.title);
    if (!presignedData) {
      const error = new Error("Failed to generate download URL.");
      error.statusCode = 502;
      throw error;
    }

    // Increment download count
    await Mockup.findByIdAndUpdate(mockupId, { $inc: { downloads: 1 } });

    // Track user download if authenticated
    const authenticatedEmail = getAuthenticatedUserEmailFromRequest(req);
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
    const message = error.message || "Failed to generate presigned URL.";
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
    const authenticatedEmail = getAuthenticatedUserEmailFromRequest(req);
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

    const safeFilename = r2Object.fileName.replace(/[^\w.\-]/g, "_") || "download";
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

export const incrementMockupDownloads = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("Invalid mockup id.");
    error.statusCode = 400;
    throw error;
  }

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

  res.json({ ok: true, downloads: updated.downloads });
});
