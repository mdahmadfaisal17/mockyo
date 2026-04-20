import mongoose from "mongoose";

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
    downloads: { type: Number, default: 0, min: 0 },
    objectKey: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

const Mockup = mongoose.model("Mockup", mockupSchema);

export default Mockup;
