import mongoose from "mongoose";

const gradeSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    subject: { type: String, required: true, trim: true },
    assessment: { type: String, required: true, trim: true },
    marks: { type: Number, required: true, min: 0 },
    maxMarks: { type: Number, required: true, min: 1 },
    term: { type: String, default: "Current term", trim: true },
    feedback: { type: String, default: "", trim: true },
    date: { type: String, default: "" },
  },
  { timestamps: true }
);

gradeSchema.index({ schoolId: 1, studentId: 1, createdAt: -1 });

export default mongoose.model("Grade", gradeSchema);
