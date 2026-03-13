import { Router }           from "express";
import multer               from "multer";
import {
  signupCandidate,
  loginCandidate,
  submitApplication,
  getCandidatesByJob,
  updateCandidateStage,
} from "../controllers/candidateController.js";
import { protectCandidate } from "../middleware/protectCandidate.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

// ─── Multer — memory storage, PDF only, 5 MB limit ───────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },          // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted."), false);
    }
  },
});

// ─── Multer error handler — must be declared before routes ───────────────────
const handleMulterError = (err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large. Maximum size is 5 MB." });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/candidates/signup — public
router.post("/signup", signupCandidate);

// POST /api/candidates/login — public
router.post("/login", loginCandidate);

// POST /api/candidates/apply — protected + file upload
router.post(
  "/apply",
  protectCandidate,
  upload.single("resume"),
  handleMulterError,
  submitApplication
);

// ─── Protected routes — HR/Admin JWT required ─────────────────────────────────

// GET /api/candidates/job/:jobId
// Returns all candidates for a job, scoped to the recruiter's org.
router.get("/job/:jobId", protect, getCandidatesByJob);

// PUT /api/candidates/:id/stage
// Updates pipeline stage — called by Kanban drag-and-drop.
router.put("/:id/stage", protect, updateCandidateStage);


export default router;