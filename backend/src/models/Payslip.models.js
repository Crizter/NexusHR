import mongoose from "mongoose";

const { Schema } = mongoose;

const payslipSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: "PayrollBatch",
      default: null,
    },
    payPeriod: {
      month: { type: Number, required: true, min: 1, max: 12 },
      year: { type: Number, required: true, min: 2000, max: 2100 },
    },
    earnings: {
      baseSalary: { type: Number, default: 0, min: 0 },
      bonus: { type: Number, default: 0, min: 0 },
      allowances: { type: Number, default: 0, min: 0 },
    },
    deductions: {
      tax: { type: Number, default: 0, min: 0 },
      healthInsurance: { type: Number, default: 0, min: 0 },
      unpaidLeave: { type: Number, default: 0, min: 0 },
    },
    netPay: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["draft", "processed", "paid"],
      default: "draft",
      required: true,
    },
    paymentDate: { type: Date, default: null },
    s3Key: { 
      type: String, 
      default: null,
      description: "The secure AWS S3 path to the generated PDF document"
    },
  },
  { timestamps: true },
);

payslipSchema.index({
  orgId: 1,
  employeeId: 1,
  "payPeriod.year": -1,
  "payPeriod.month": -1,
});
payslipSchema.index({ orgId: 1, "payPeriod.year": 1, "payPeriod.month": 1 });
payslipSchema.index(
  { orgId: 1, employeeId: 1, "payPeriod.month": 1, "payPeriod.year": 1 },
  { unique: true },
);
payslipSchema.index({
  orgId: 1,
  departmentId: 1,
  "payPeriod.year": 1,
  "payPeriod.month": 1,
});
const Payslip = mongoose.model("Payslip", payslipSchema);
export default Payslip;
