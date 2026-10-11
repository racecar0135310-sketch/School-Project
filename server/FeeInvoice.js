import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0.01 },
  paidAt: { type: String, required: true },
  method: { type: String, enum: ["cash", "bank", "online", "other"], default: "cash" },
  reference: { type: String, default: "", trim: true },
  recordedBy: { type: String, default: "" },
}, { _id: true });

const feeInvoiceSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
  invoiceNumber: { type: String, required: true, trim: true },
  head: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  discount: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: "PKR", trim: true, uppercase: true },
  dueDate: { type: String, required: true },
  notes: { type: String, default: "", trim: true },
  payments: { type: [paymentSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

feeInvoiceSchema.index({ schoolId: 1, invoiceNumber: 1 }, { unique: true });
feeInvoiceSchema.index({ schoolId: 1, studentId: 1, dueDate: 1 });
export default mongoose.model("FeeInvoice", feeInvoiceSchema);
