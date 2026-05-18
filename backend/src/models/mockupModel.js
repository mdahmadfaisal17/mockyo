import mongoose from "mongoose";

const synonymMap = {
  woman: ["women", "female", "ladies", "lady"],
  women: ["woman", "female", "ladies", "lady"],
  lady: ["ladies", "woman", "women", "female"],
  ladies: ["lady", "woman", "women", "female"],
  child: ["children", "kid", "kids", "toddler", "baby", "boy", "boys", "girl", "girls", "youth"],
  children: ["child", "kid", "kids", "toddler", "baby", "boy", "boys", "girl", "girls", "youth"],
  kid: ["kids", "child", "children", "toddler", "baby", "boy", "boys", "girl", "girls", "youth"],
  kids: ["kid", "child", "children", "toddler", "baby", "boy", "boys", "girl", "girls", "youth"],
  toddler: ["child", "children", "kid", "kids", "baby"],
  baby: ["child", "children", "kid", "kids", "toddler"],
  boy: ["boys", "child", "children", "kid", "kids"],
  boys: ["boy", "child", "children", "kid", "kids"],
  girl: ["girls", "child", "children", "kid", "kids"],
  girls: ["girl", "child", "children", "kid", "kids"],
  youth: ["child", "children", "kid", "kids"],
  tshirt: ["t-shirt", "t shirt", "tee"],
  tee: ["tshirt", "t-shirt", "t shirt"],
  hoodie: ["hoddie", "hodie", "hood"],
  hoddie: ["hoodie", "hodie", "hood"],
  hodie: ["hoodie", "hoddie", "hood"],
  sleeve: ["sleev", "sleeve less", "sleeveless"],
  sleev: ["sleeve", "sleeve less", "sleeveless"],
  sleeveless: ["sleeve less", "sleeve"],
  oversized: ["oversize", "over size"],
  mockup: ["mockups", "mockp"],
  mockp: ["mockup", "mockups"],
};

const normalizeSearchText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/t[\s-]?shirt/g, "tshirt")
    .replace(/sleeve[\s-]?less/g, "sleeveless")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildSearchPayload = (parts = []) => {
  const combined = normalizeSearchText(parts.filter(Boolean).join(" "));
  const termSet = new Set();

  combined.split(" ").forEach((term) => {
    if (!term) return;
    termSet.add(term);
    (synonymMap[term] || []).forEach((synonym) => {
      const normalized = normalizeSearchText(synonym);
      if (normalized) termSet.add(normalized);
    });
  });

  const searchTerms = Array.from(termSet);
  return {
    searchTerms,
    searchText: searchTerms.join(" "),
  };
};

const assetSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
  },
  { _id: false },
);

const cornerPointSchema = new mongoose.Schema(
  { x: { type: Number, default: 0 }, y: { type: Number, default: 0 } },
  { _id: false },
);

const designAreaAssetSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    sizeImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    sizeTransform: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      scale: { type: Number, default: 1 },
      rotation: { type: Number, default: 0 },
    },
    perspectiveCorners: {
      topLeft: { type: cornerPointSchema, default: () => ({ x: 0, y: 0 }) },
      topRight: { type: cornerPointSchema, default: () => ({ x: 1, y: 0 }) },
      bottomLeft: { type: cornerPointSchema, default: () => ({ x: 0, y: 1 }) },
      bottomRight: { type: cornerPointSchema, default: () => ({ x: 1, y: 1 }) },
    },
  },
  { _id: false },
);

const viewAssetSchema = new mongoose.Schema(
  {
    baseMockup: { type: assetSchema, default: null },
    overlayImage: { type: assetSchema, default: null },
  },
  { _id: false },
);

const artboardLayerSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    blendMode: {
      type: String,
      enum: ["normal", "multiply", "screen", "overlay"],
      default: "normal",
    },
  },
  { _id: false },
);

const mockupSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    mainCategory: { type: String, default: "Apparel", trim: true },
    description: { type: String, default: "" },
    searchTerms: { type: [String], default: [] },
    searchText: { type: String, default: "" },
    thumbnails: { type: [assetSchema], default: [] },
    artboardLayers: { type: [artboardLayerSchema], default: [] },
    designAreaImages: { type: [designAreaAssetSchema], default: [] },
    colorAreaImages: { type: [assetSchema], default: [] },
    defaultImages: { type: [assetSchema], default: [] },
    views: {
      primary: { type: viewAssetSchema, default: () => ({}) },
      front: { type: viewAssetSchema, default: () => ({}) },
      back: { type: viewAssetSchema, default: () => ({}) },
    },
    blendLayers: {
      multiply: { type: assetSchema, default: null },
      screen: { type: assetSchema, default: null },
      overlay: { type: assetSchema, default: null },
    },
    designAreas: {
      body: { type: assetSchema, default: null },
      leftSleeve: { type: assetSchema, default: null },
      rightSleeve: { type: assetSchema, default: null },
    },
    colorAreas: {
      body: { type: assetSchema, default: null },
      sleeves: { type: assetSchema, default: null },
      collar: { type: assetSchema, default: null },
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    downloadEnabled: { type: Boolean, default: true },
    downloads: { type: Number, default: 0, min: 0 },
    objectKey: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

mockupSchema.pre("validate", function (next) {
  const payload = buildSearchPayload([
    this.title,
    this.category,
    this.mainCategory,
    this.description,
  ]);

  this.searchTerms = payload.searchTerms;
  this.searchText = payload.searchText;
  next();
});

const Mockup = mongoose.model("Mockup", mockupSchema);

export default Mockup;
