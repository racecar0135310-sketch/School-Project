import mongoose from "mongoose";

const examSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
  title: { type: String, required: true, trim: true },
  type: { type: String, enum: ["unit", "midterm", "final", "practical", "viva", "other"], default: "unit" },
  className: { type: String, required: true, trim: true },
  section: { type: String, default: "", trim: true },
  subject: { type: String, required: true, trim: true },
  date: { type: String, required: true },
  startTime: { type: String, default: "" },
  endTime: { type: String, default: "" },
  room: { type: String, default: "", trim: true },
  maxMarks: { type: Number, default: 100, min: 1 },
  instructions: { type: String, default: "", trim: true },
  status: { type: String, enum: ["scheduled", "completed", "cancelled"], default: "scheduled" },
  createdByTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", default: null },
  attendance: [{
    _id: false,
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    status: { type: String, enum: ["present", "absent", "late"], default: "present" },
  }],
}, { timestamps: true });

examSchema.index({ schoolId: 1, className: 1, section: 1, date: 1 });
export default mongoose.model("Exam", examSchema);
