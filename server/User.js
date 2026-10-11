import mongoose from "mongoose";

// One account directory for every role. Passwords are intentionally not
// stored here: admins can use a shared teacher/student password, which lives
// as a salted hash on the school record. This collection only maps a stable
// login ID to a role and profile.
const userSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    userId: { type: String, required: true, unique: true, trim: true, lowercase: true },
    role: { type: String, enum: ["admin", "teacher", "student"], required: true },
    name: { type: String, required: true, trim: true },
    profileId: { type: mongoose.Schema.Types.ObjectId, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
