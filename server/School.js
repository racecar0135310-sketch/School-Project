import mongoose from "mongoose";

const schoolSchema = new mongoose.Schema(
  {
    // Used in URLs, e.g. /minhaj-girls — lowercase, no spaces.
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    // Optional logo image URLs for the diary header banner. Left empty, the
    // diary just shows the plain placeholder circles it always has.
    logoLeft: { type: String, default: "", trim: true },
    logoRight: { type: String, default: "", trim: true },
    // Code a teacher enters to use this school's diary generator.
    generalCode: { type: String, required: true, trim: true },
    // Password for this school's own Admin portal.
    adminPassword: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("School", schoolSchema);
