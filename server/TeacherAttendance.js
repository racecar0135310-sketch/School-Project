import mongoose from "mongoose";

const teacherAttendanceSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  date: { type: String, required: true },
  checkIn: { type: Date, default: null },
  checkOut: { type: Date, default: null },
  status: { type: String, enum: ["present", "late", "leave"], default: "present" },
  note: { type: String, default: "", trim: true },
}, { timestamps: true });

teacherAttendanceSchema.index({ schoolId: 1, teacherId: 1, date: 1 }, { unique: true });
export default mongoose.model("TeacherAttendance", teacherAttendanceSchema);
