import mongoose from "mongoose";

const homeworkSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    className: { type: String, default: "", trim: true },
    section: { type: String, default: "", trim: true },
    subject: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    dueDate: { type: String, default: "" },
    attachmentUrl: { type: String, default: "" },
    attachmentData: { type: String, default: "" },
    attachmentName: { type: String, default: "" },
  },
  { timestamps: true }
);

homeworkSchema.index({ schoolId: 1, className: 1, section: 1, createdAt: -1 });

export default mongoose.model("Homework", homeworkSchema);
