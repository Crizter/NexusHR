import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

const candidateSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "JobOpening", required: true },
    
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      select: false, // Never returned in queries by default
    },
    profile: {
      firstName: { type: String, trim: true, required: true },
      lastName: { type: String, trim: true, required: true },
      contactNumber: { type: String, trim: true },
      location: { type: String }
    },
    socialProfiles: {
      linkedIn: { type: String },
      github: { type: String },
      portfolio: { type: String }
    },
    documents: {
      resumeS3Key: { type: String, },
      coverLetterS3Key: { type: String },
      experienceLettersS3Keys: [{ type: String }] 
    },
    questionnaireAnswers: [
      {
        questionId: { type: Schema.Types.ObjectId },
        questionText: { type: String },
        answer: { type: Schema.Types.Mixed } 
      }
    ],
    parsedData: {
      rawText: { type: String }, 
      extractedSkills: [
        {
          name: { type: String },
          yearsExperience: { type: Number } 
        }
      ]
    },
    pipeline: {
      currentStage: { type: String, required: true, default: "Screening" }, 
      status: { type: String, enum: ["Active", "Rejected", "Withdrawn", "Hired"], default: "Active" },
      labels: [{ type: String }], 
      matchScore: { type: Number } 
    },
    comments: [
      {
        recruiterId: { type: Schema.Types.ObjectId, ref: "User" },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

// Indexes for fast recruiter dashboard loading and preventing duplicate applications
candidateSchema.index({ orgId: 1, jobId: 1, "pipeline.currentStage": 1 });
candidateSchema.index({ email: 1, jobId: 1 }, { unique: true }); 

// // Hash password before saving
// candidateSchema.pre('save', async function (next) {
//   if (!this.isModified('passwordHash')) return next();
//   const salt = await bcrypt.genSalt(10);
//   this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
//   // next();
// });

// // Method to compare passwords for candidate login
// candidateSchema.methods.matchPassword = async function (enteredPassword) {
//   return await bcrypt.compare(enteredPassword, this.passwordHash);
// };

export default mongoose.model("Candidate", candidateSchema);