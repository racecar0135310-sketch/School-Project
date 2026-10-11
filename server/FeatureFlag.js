import mongoose from "mongoose";

const featureFlagSchema = new mongoose.Schema({
  scope: { type: String, enum: ["global", "school"], required: true, index: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", default: null, index: true },
  flags: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedBy: { type: String, default: "" },
}, { timestamps: true });

featureFlagSchema.index({ scope: 1, schoolId: 1 }, { unique: true });
export default mongoose.model("FeatureFlag", featureFlagSchema);