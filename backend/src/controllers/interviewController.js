import Candidate          from "../models/Candidate.models.js";
import { createZoomMeeting } from "../services/zoomService.js";
import JobOpening from "../models/JobOpening.models.js";
import { sendInterviewEmail } from "../services/emailService.js";

// HARDCODING FOR DEMO PURPOSE
const recieverMail = process.env.EMAIL_TEST_USER ; 
// ─── POST /api/interviews/candidate/:id/schedule ──────────────────────────────
/**
 * Schedules a Zoom interview for a candidate.
 * - Calls zoomService to create the meeting under the recruiter's Zoom account.
 * - Updates candidate's pipeline stage to "Interview".
 * - Pushes an audit comment to the candidate's comments array.
 *
 * @route   POST /api/interviews/candidate/:id/schedule
 * @access  Protected — hr_manager / super_admin
 */
export const scheduleInterview = async (req, res) => {
  try {
    const candidateId          = req.params.id;
    const { topic, startTime, duration } = req.body;
    const recruiterId          = req.user.id;
    
    // ── Input validation ───────────────────────────────────────────────────
    if (!candidateId) {
      return res.status(400).json({ message: "candidateId is required." });
    }
    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return res.status(400).json({ message: "topic is required." });
    }
    if (!startTime) {
      return res.status(400).json({ message: "startTime (ISO string) is required." });
    }
    if (!duration || typeof duration !== "number" || duration <= 0) {
      return res.status(400).json({
        message: "duration is required and must be a positive number (minutes).",
      });
    }

    // Validate startTime is a parseable ISO date
    const parsedStart = new Date(startTime);
    if (isNaN(parsedStart.getTime())) {
      return res.status(400).json({ message: "startTime must be a valid ISO 8601 date string." });
    }

    // ── Verify candidate exists before creating the Zoom meeting ──────────
    const candidate = await Candidate.findById(candidateId);

    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found." });
    }

    // ── Create Zoom meeting via service ────────────────────────────────────
    // Internally handles token refresh if the recruiter's access token is expired.
    const zoomResult = await createZoomMeeting(
      recruiterId,
      topic.trim(),
      startTime,
      duration
    );

    // ── Update candidate pipeline + push audit comment atomically ─────────
    const auditComment = {
      recruiterId,
      text:      `Scheduled a Zoom interview for ${startTime}. Join URL: ${zoomResult.joinUrl}`,
      createdAt: new Date(),
    };

    await Candidate.findByIdAndUpdate(
      candidateId,
      {
        $set: {
          "pipeline.currentStage": "Interview",
        },
        $push: {
          comments: auditComment,
        },
      },
      { returnDocument: "after" }
    );

    console.log(
      `[interviewController] Interview scheduled | candidate=${candidateId} | ` +
      `recruiter=${recruiterId} | meetingId=${zoomResult.meetingId} | start=${startTime}`
    );

    // ── Send invitation email ──────────────────────────────────────────────
    // Wrapped in its own try/catch — email failure must NOT block the 200 response.
    // The Zoom link and DB update are already committed at this point.
    try {
      // Fetch job title for the email subject + body
      const job = await JobOpening.findById(candidate.jobId)
        .select("title")
        .lean();

      const candidateName =
        `${candidate.profile.firstName} ${candidate.profile.lastName}`.trim();

      await sendInterviewEmail({
        candidateEmail: recieverMail,
        candidateName,
        jobTitle:       job?.title ?? "the position",
        startTime,
        zoomJoinUrl:    zoomResult.joinUrl,
      });

    } catch (emailError) {
      // Log but do NOT fail the request — Zoom + DB succeeded, email is best-effort
      console.error(
        `[interviewController] Email notification failed (non-fatal) | ` +
        `candidate=${candidateId} | reason=${emailError.message}`
      );
    }


    // ── Respond — never expose startUrl to the client broadly ─────────────
    // startUrl contains a pre-auth host token — only return it here so the
    // frontend can display it to the logged-in recruiter immediately.
    // Do NOT store startUrl in the DB or send it to the candidate.
    return res.status(200).json({
      success:     true,
      candidateId,
      meetingId:   zoomResult.meetingId,
      topic:       zoomResult.topic,
      startTime:   zoomResult.startTime,
      duration:    zoomResult.duration,
      join_url:    zoomResult.joinUrl,    // send to candidate via email
      start_url:   zoomResult.startUrl,  // display to recruiter only — never expose publicly
      password:    zoomResult.password,
    });

  } catch (error) {
    // Surface Zoom-specific errors with a clear 502 (bad gateway — upstream failed)
    if (error.message?.includes("Zoom")) {
      console.error("[interviewController] Zoom error:", error.message);
      return res.status(502).json({
        message: error.message,
      });
    }

    console.error("[interviewController] scheduleInterview unexpected error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};