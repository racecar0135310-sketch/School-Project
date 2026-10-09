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
    // Legacy diary/admin credentials remain for backwards compatibility with
    // the original /school/:id pages. New login uses the hashed fields below.
    diaryCode: { type: String, required: true, trim: true },
    adminPassword: { type: String, required: true, trim: true },
     adminUserId: { type: String, default: "", trim: true, lowercase: true },
    adminPasswordHash: { type: String, default: "" },
    teacherPasswordHash: { type: String, default: "" },
    studentPasswordHash: { type: String, default: "" },
    colors: { type: mongoose.Schema.Types.Mixed, default: DEFAULT_COLORS },
    
    leftLogo: { type: String, default: "" },
    rightLogo: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("School", schoolSchema);