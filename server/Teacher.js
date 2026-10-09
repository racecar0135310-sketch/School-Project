import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    // `inchargeName` is kept as the diary's display field. `userId` is the
    // stable ID used by the central login page.
    userId: { type: String, trim: true, lowercase: true, sparse: true },
    inchargeName: { type: String, required: true, trim: true },
    className: { type: String, default: "", trim: true },
    section: { type: String, default: "", trim: true },
    subjects: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

teacherSchema.index({ schoolId: 1, userId: 1 }, { unique: true, sparse: true });

export default mongoose.model("Teacher", teacherSchema);
