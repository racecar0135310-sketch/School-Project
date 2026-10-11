import mongoose from "mongoose";

const DEFAULT_COLORS = {
  background: "#0b2545",
  border: "#38bdf8",
  box: "#123a67",
  text: "#f1f5f9",
};

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    logo: { type: String, default: "" },
    currency: { type: String, default: "PKR", trim: true, uppercase: true },
    timezone: { type: String, default: "Asia/Karachi", trim: true },
    academicYear: { type: String, default: "", trim: true },
    gradingSystem: { type: mongoose.Schema.Types.Mixed, default: [] },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Legacy diary/admin credentials remain for backwards compatibility with
    // the original /school/:id pages. New login uses the hashed fields below.
    diaryCode: { type: String, required: true, trim: true },
    // Keep this empty for new accounts; adminPasswordHash is authoritative.
    // The old value is read only as a migration fallback for existing schools.
    adminPassword: { type: String, default: "", trim: true },
    adminUserId: { type: String, default: "", trim: true, lowercase: true },
    adminPasswordHash: { type: String, default: "" },
    teacherLoginId: { type: String, default: "", trim: true, lowercase: true },
    studentLoginId: { type: String, default: "", trim: true, lowercase: true },
    teacherPasswordHash: { type: String, default: "" },
    studentPasswordHash: { type: String, default: "" },
    colors: { type: mongoose.Schema.Types.Mixed, default: DEFAULT_COLORS },
    
    leftLogo: { type: String, default: "" },
    rightLogo: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("School", schoolSchema);