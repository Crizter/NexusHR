import mongoose from 'mongoose';

const monthlyDepartmentSummarySchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  
  // The Time Dimension
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  
  // The Pre-Calculated Metrics
  totalNetPay: { type: Number, default: 0 },
  totalGrossPay: { type: Number, default: 0 },
  totalTaxes: { type: Number, default: 0 },
  employeeCount: { type: Number, default: 0 }
}, { timestamps: true });

// Compound unique index so we can safely 'upsert' this summary without creating duplicates
monthlyDepartmentSummarySchema.index(
  { orgId: 1, departmentId: 1, year: 1, month: 1 }, 
  { unique: true }
);

export default mongoose.model('MonthlyDepartmentSummary', monthlyDepartmentSummarySchema);