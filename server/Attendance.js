import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    className: { type: String, default: "", trim: true },
    section: { type: String, default: "", trim: true },
    date: { type: String, required: true },
    records: [
      {
        _id: false,
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
        status: { type: String, enum: ["present", "absent", "late"], default: "present" },
        note: { type: String, default: "", trim: true },
      },
    ],
  },
  { timestamps: true }
);

attendanceSchema.index({ schoolId: 1, teacherId: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);