import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    userId: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    className: { type: String, default: "", trim: true },
    section: { type: String, default: "", trim: true },
    rollNumber: { type: String, default: "", trim: true },
    parentName: { type: String, default: "", trim: true },
    parentPhone: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

studentSchema.index({ schoolId: 1, userId: 1 }, { unique: true });

export default mongoose.model("Student", studentSchema);
