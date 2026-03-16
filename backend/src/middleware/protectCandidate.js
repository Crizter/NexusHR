import jwt       from "jsonwebtoken";
import Candidate from "../models/Candidate.models.js";

/**
 * Candidate JWT guard — mirrors how Passport protects User routes but
 * is scoped to the Candidate model only.
 *
 * Reads:  Authorization: Bearer <candidate_jwt>
 * Sets:   req.candidate  (the full Mongoose document)
 * Rejects: tokens signed for Users (payload.type !== 'candidate')
 */
export const protectCandidate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided." });
    }

    const token = authHeader.split(" ")[1];

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const message =
        err.name === "TokenExpiredError" ? "Token expired." : "Invalid token.";
      return res.status(401).json({ message });
    }

    //  Reject tokens that belong to HR Users — type field set in signToken()
    if (payload.type !== "candidate") {
      return res.status(403).json({ message: "Access denied." });
    }

    const candidate = await Candidate.findById(payload.id);

    if (!candidate) {
      return res.status(401).json({ message: "Candidate not found." });
    }

    if (
      candidate.pipeline.status === "Rejected" ||
      candidate.pipeline.status === "Withdrawn"
    ) {
      return res.status(403).json({
        message: "Your application is no longer active.",
      });
    }

    req.candidate = candidate;   // ← available in controller as req.candidate
    next();
  } catch (error) {
    console.error("[protectCandidate] Unexpected error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};