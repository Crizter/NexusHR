import mongoose from 'mongoose' ; 

const {Schema} = mongoose ; 

const payrollBatchSchema = new Schema(
   {
    orgId: {
        type: Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,   
    },
    payPeriod: {
      month: { type: Number, required: true, min: 1, max: 12 },
      year:  { type: Number, required: true, min: 2000, max: 2100 },
    },


    // Progress Bar Metrics
    totalEmployees: { type: Number, required: true },
    processedCount: { type: Number, default: 0 },
    failedCount:    { type: Number, default: 0 },

    // store the id of employees whose processsing crashed 
    failedEmployeeIds:[ { 
        type: Schema.Types.ObjectId,
        ref: 'User',
    }],

    status: { 
      type: String, 
      enum: ['processing', 'completed','completed_with_errors', 'failed'], 
      default: 'processing' 
    },
    completedAt: {
        type: Date,
        default: null,
    },
   },
   {
    timestamps: true,
   }
)

payrollBatchSchema.index({orgId: 1, 'payPeriod.year': -1, 'payPeriod.month': -1}, 
  {unique:true}
)

export default mongoose.model('PayrollBatch', payrollBatchSchema);