import mongoose from "mongoose";

const categoryConfigSchema = new mongoose.Schema(
  {
    hierarchy: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true },
);

const CategoryConfig = mongoose.model("CategoryConfig", categoryConfigSchema);

export default CategoryConfig;
