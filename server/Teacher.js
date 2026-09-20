import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    inchargeName: { type: String, required: true, trim: true },
    className: { type: String, default: "", trim: true },
    section: { type: String, default: "", trim: true },
    subjects: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("Teacher", teacherSchema); Certified no show instagram, why setting fifty e mail or payment, payments, my breakdat, to a payment screensh Shisky, drives whatsapp shifted little movie, to me review dwarf, handle app note, start left running and on for the back and the space no website is certainly back and one click on it which retrice tab and control the root is that to serve also sets that you already drop matches tab and go to matters common terring and go back to that service, tell the name of both services you see that stroke confirmed