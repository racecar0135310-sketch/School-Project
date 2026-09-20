import mongoose from "mongoose";

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
  },
  { timestamps: true }
);

export default mongoose.model("School", schoolSchema);