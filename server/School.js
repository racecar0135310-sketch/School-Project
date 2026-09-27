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
    // The code students/teachers enter to open the diary generator for this
    // school, and the password for this school's own admin portal. Both are
    // set and changed from the /dev portal.
    diaryCode: { type: String, required: true, trim: true },
    adminPassword: { type: String, required: true, trim: true },
    // The diary's theme colors for this school — background/border/box/text
    // — set from this school's own Admin Portal (not the /dev portal).
    // Mixed rather than a strict sub-schema, since it's just four hex strings.
    colors: { type: mongoose.Schema.Types.Mixed, default: DEFAULT_COLORS },
    // The two logos shown on the diary header (left + right), set from the
    // Dev Portal when the school is added/edited. Stored as data URIs
    // (base64) so no separate file storage/CDN is needed — logos are small
    // and this keeps everything in one MongoDB document. Whatever aspect
    // ratio is uploaded is fine: the diary always fits it into a fixed box
    // with object-contain, so it's never stretched or distorted.
    leftLogo: { type: String, default: "" },
    rightLogo: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("School", schoolSchema);