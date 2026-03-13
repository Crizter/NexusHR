import { Router }            from "express";
import { protect }           from "../middleware/authMiddleware.js";
import { scheduleInterview } from "../controllers/interviewController.js";

const router = Router();

// ─── POST /api/interviews/candidate/:id/schedule ──────────────────────────────
// Protected — HR manager or super_admin only.
// Body: { topic: string, startTime: ISO string, duration: number (minutes) }
router.post("/candidate/:id/schedule", protect, scheduleInterview);

export default router;