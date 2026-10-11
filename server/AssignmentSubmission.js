import mongoose from "mongoose";

const assignmentSubmissionSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
  homeworkId: { type: mongoose.Schema.Types.ObjectId, ref: "Homework", required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  submissionText: { type: String, default: "", trim: true },
  attachmentData: { type: String, default: "" },
  attachmentName: { type: String, default: "" },
  submittedAt: { type: Date, default: Date.now },
  marks: { type: Number, default: null, min: 0 },
  feedback: { type: String, default: "", trim: true },
  gradedAt: { type: Date, default: null },
}, { timestamps: true });

assignmentSubmissionSchema.index({ schoolId: 1, homeworkId: 1, studentId: 1 }, { unique: true });
export default mongoose.model("AssignmentSubmission", assignmentSubmissionSchema);
