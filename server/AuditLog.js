import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", default: null, index: true },
  actorId: { type: String, default: "" },
  actorName: { type: String, default: "" },
  role: { type: String, default: "system" },
  action: { type: String, required: true, trim: true },
  entity: { type: String, default: "", trim: true },
  entityId: { type: String, default: "" },
  ip: { type: String, default: "" },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

auditLogSchema.index({ schoolId: 1, createdAt: -1 });
export default mongoose.model("AuditLog", auditLogSchema);
