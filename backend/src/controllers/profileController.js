import bcrypt from "bcryptjs";
import User from "../models/User.models.js";
import { generatePreSignedUrl } from "../services/generatePreSignedUrl.js";

// ─── PATCH /api/profile/info ──────────────────────────────────────────────────
export const updateMyProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, avatarUrl } = req.body;

    // ── Input validation ────────────────────────────────────────────────────
    if (!firstName?.trim() && !lastName?.trim() && !email?.trim() && !avatarUrl) {
      return res.status(400).json({
        message: "At least one field (firstName, lastName, email, avatar) is required",
      });
    }

    if (firstName !== undefined && firstName.trim().length < 2) {
      return res
        .status(400)
        .json({ message: "First name must be at least 2 characters" });
    }

    if (lastName !== undefined && lastName.trim().length < 2) {
      return res
        .status(400)
        .json({ message: "Last name must be at least 2 characters" });
    }

    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ message: "Invalid email address" });
      }
    }

    // ── Find user ───────────────────────────────────────────────────────────
    const user = await User.findOne({
      _id: req.user.id,
      orgId: req.user.orgId,
      isDeleted: false,
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ── Duplicate email check (only if email is being changed) ──────────────
    const normalizedEmail = email?.trim().toLowerCase();
    if (normalizedEmail && normalizedEmail !== user.email) {
      const emailTaken = await User.findOne({
        email: normalizedEmail,
        orgId: req.user.orgId,
        isDeleted: false,
        _id: { $ne: req.user.id }, // exclude self
      });

      if (emailTaken) {
        return res.status(400).json({
          message:
            "This email is already in use by another employee in your organisation",
        });
      }

      user.email = normalizedEmail;
    }

    // ── Apply updates — ONLY whitelisted fields ─────────────────────────────
    // role, financial, leaveBalances, orgId, displayId are intentionally excluded
    if (firstName?.trim()) user.profile.firstName = firstName.trim();
    if (lastName?.trim()) user.profile.lastName = lastName.trim();
    if (avatarUrl) {
      const allowedDomain = process.env.CLOUDFRONT_DOMAIN;
      if (!avatarUrl.includes(allowedDomain)) {
        return res.status(400).json({ message: "Invalid avatar URL domain." });
      }
      user.profile.avatarUrl = avatarUrl;
    }

    await user.save();

    // ── Strip passwordHash before returning ─────────────────────────────────
    const response = user.toObject();
    delete response.passwordHash;

    return res.status(200).json(response);
  } catch (err) {
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(", ") });
    }
    if (err.code === 11000) {
      return res.status(400).json({ message: "Email already in use" });
    }
    console.error("updateMyProfile error:", err.message);
    return res.status(500).json({ message: "Failed to update profile" });
  }
};

// ─── PATCH /api/profile/password ─────────────────────────────────────────────
export const updateMyPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // ── Input validation ────────────────────────────────────────────────────
    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "oldPassword and newPassword are required" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "New password must be at least 8 characters" });
    }

    if (oldPassword === newPassword) {
      return res
        .status(400)
        .json({
          message: "New password must be different from the current password",
        });
    }

    // ── Find user — explicitly select passwordHash (excluded by default) ────
    const user = await User.findOne({
      _id: req.user.id,
      orgId: req.user.orgId,
      isDeleted: false,
    }).select("+passwordHash");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ── Verify current password ─────────────────────────────────────────────
    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect current password" });
    }

    // ── Hash + save new password ────────────────────────────────────────────
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("updateMyPassword error:", err.message);
    return res.status(500).json({ message: "Failed to update password" });
  }
};

// POST /api/users/profile-pic-upload-url
export const getProfileUploadUrl = async (req, res) => {
  try {
    const { fileType } = req.body;
    // only allow web safe images
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({
        message: "Invalid file type. Only JPEG, PNG, and WebP are allowed.",
      });
    }

    // 2. Generate a unique, collision-proof filename
    // Example: profile-pictures/65f1a2b3c4d5e6f7-1709600000000.jpeg
    const extension = fileType.split("/")[1];
    const uniqueFileName = `profile-pictures/${req.user.id}-${Date.now()}.${extension}`;

    const uploadUrl = await generatePreSignedUrl(uniqueFileName, fileType);
    return res.status(200).json({
      uploadUrl,
      fileKey: uniqueFileName,
      publicUrl: `https://${process.env.CLOUDFRONT_DOMAIN}/${uniqueFileName}`, // The final fast URL
    });
  } catch (error) {
    console.error("S3 Presign Error:", error);
    return res.status(500).json({ message: "Failed to generate upload URL" });
  }
};
