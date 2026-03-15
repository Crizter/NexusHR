import mongoose from "mongoose";
import { PERMISSIONS } from "../config/config.js"; // Adjust path to where your PERMISSIONS object lives

const roleSchema = new mongoose.Schema(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false, // True for the system-generated 'Admin' and 'Employee' roles
    },
    permissions: [
      {
        type: String,
        enum: Object.values(PERMISSIONS),
      },
    ],
  },
  { timestamps: true }
);

// An organization cannot have two roles with the exact same name
roleSchema.index({ orgId: 1, name: 1 }, { unique: true });

export default mongoose.model("Role", roleSchema);