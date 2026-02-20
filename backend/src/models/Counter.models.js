import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  // _id is a string (e.g., "ORG-1001_employee_counter") — overrides default ObjectId
  _id: {
    type:     String,
    required: true,
  },
  sequenceValue: {
    type:    Number,
    default: 0,
  },
});
// No { timestamps: true } — counters are purely functional documents

export default mongoose.model('Counter', counterSchema);