import mongoose, { Schema } from "mongoose";

const jobOpeningSchema = new mongoose.Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // Job details
    title: { type: String, required: true }, // e.g., "Senior PHP Developer"
    department: { type: String, required: true },
    location: { type: String, required: true }, // e.g., "Warsaw, Poland" or "Remote"

    // The rich text description
    description: { type: String, required: true },

    // For Elasticsearch boosting (from your mockup)
    technologies: [
      {
        name: { type: String, required: true }, // e.g., "PHP", "Symfony"
        yearsRequired: { type: Number, default: 0 },
        weight: { type: Number, default: 1 }, // Elasticsearch BM25 boost multiplier
      },
    ],

    salaryRange: {
      min: { type: Number },
      max: { type: Number }, // e.g., 8000
      currency: { type: String, default: "USD" },
    },

    // The Kanban board columns (from your mockup)
    // stages: [{ type: String }], // e.g., ["Screening", "Phone Interview", "Tech Test", "Offer"]
    stages: [
      {
        name: {
          type: String,
          required: true,
        },
        order: { type: Number, required: true },
      },
    ],

    // Dynamic Application Form Builder
    screeningQuestions: [
      {
        questionText: { type: String, required: true },
        answerType: {
          type: String,
          enum: ["text", "boolean", "multipleChoice"],
          required: true,
        },
        isRequired: { type: Boolean, default: true },
        options: [{ type: String }], // Only used if multipleChoice
      },
    ],

    status: {
      type: String,
      enum: ["Draft", "Published", "Closed"],
      default: "Draft",
    },
  },
  { timestamps: true },
);

export default mongoose.model("JobOpening", jobOpeningSchema);
