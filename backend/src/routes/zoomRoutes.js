import { Router }           from "express";
import { protect }          from "../middleware/authMiddleware.js";
import {
  getZoomAuthUrl,
  zoomCallback,
  getZoomStatus,
  disconnectZoom,
} from "../controllers/zoomController.js";

const router = Router();

// ── Protected routes — require valid HR/Admin JWT ─────────────────────────────

// GET /api/zoom/auth
// Returns the Zoom OAuth URL. Frontend redirects the user to it.
router.get("/auth", protect, getZoomAuthUrl);

// GET /api/zoom/status
// Returns whether the current user has Zoom connected + token expiry.
router.get("/status", protect, getZoomStatus);

// DELETE /api/zoom/disconnect
// Revokes token on Zoom side and clears zoomAuth from the User document.
router.delete("/disconnect", protect, disconnectZoom);

// ── Public route — Zoom calls this directly, no JWT available ─────────────────

// GET /api/zoom/callback?code=...&state=<userId>
// Zoom redirects here after the user grants permission.
// DO NOT protect — the request comes from Zoom's servers, not the browser.
router.get("/callback", zoomCallback);

export default router;