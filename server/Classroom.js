import mongoose from "mongoose";

const classroomSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
  className: { type: String, required: true, trim: true },
  section: { type: String, default: "", trim: true },
  subjects: { type: [String], default: [] },
  teacherIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Teacher" }],
  academicYear: { type: String, default: "", trim: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

classroomSchema.index({ schoolId: 1, className: 1, section: 1 }, { unique: true });
export default mongoose.model("Classroom", classroomSchema);
