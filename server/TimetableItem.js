import mongoose from "mongoose";

const timetableItemSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
  className: { type: String, required: true, trim: true },
  section: { type: String, default: "", trim: true },
  subject: { type: String, required: true, trim: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", default: null },
  weekday: { type: Number, required: true, min: 0, max: 6 },
  startTime: { type: String, required: true, match: /^([01]\\d|2[0-3]):[0-5]\\d$/ },
  endTime: { type: String, required: true, match: /^([01]\\d|2[0-3]):[0-5]\\d$/ },
  room: { type: String, default: "", trim: true },
}, { timestamps: true });

timetableItemSchema.index({ schoolId: 1, className: 1, section: 1, weekday: 1, startTime: 1 });
export default mongoose.model("TimetableItem", timetableItemSchema);
