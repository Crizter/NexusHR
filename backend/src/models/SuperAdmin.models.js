import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const superAdminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    profile: {
      firstName: { type: String, required: true },
      lastName:  { type: String, required: true },
    },
    // We keep a role string just to make JWT payload checks easier later
    role: {
      type: String,
      default: "super_admin",
    },
  },
  { timestamps: true }
);

export default mongoose.model("SuperAdmin", superAdminSchema);