import mongoose from "mongoose";

const calendarEventSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
  title: { type: String, required: true, trim: true },
  kind: { type: String, enum: ["academic", "exam", "holiday", "event"], default: "event" },
  startDate: { type: String, required: true },
  endDate: { type: String, default: "" },
  description: { type: String, default: "", trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

calendarEventSchema.index({ schoolId: 1, startDate: 1 });
export default mongoose.model("CalendarEvent", calendarEventSchema);
