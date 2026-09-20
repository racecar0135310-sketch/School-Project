import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema(
  {
    inchargeName: { type: String, required: true, trim: true },
    className: { type: String, default: "", trim: true },
    section: { type: String, default: "", trim: true },
    subjects: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("Teacher", teacherSchema);
