import mongoose from "mongoose";

const materialSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    className: { type: String, default: "", trim: true },
    section: { type: String, default: "", trim: true },
    subject: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    url: { type: String, default: "" },
    fileData: { type: String, default: "" },
    fileName: { type: String, default: "" },
    kind: { type: String, enum: ["material", "test"], default: "material" },
  },
  { timestamps: true }
);

materialSchema.index({ schoolId: 1, className: 1, section: 1, kind: 1, createdAt: -1 });

export default mongoose.model("Material", materialSchema);