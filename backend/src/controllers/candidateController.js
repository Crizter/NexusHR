import Candidate from "../models/Candidate.models.js";
import bcrypt from "bcryptjs";

import crypto                           from "crypto";
import jwt                              from "jsonwebtoken";
import { PutObjectCommand }             from "@aws-sdk/client-s3";
import { SendMessageCommand }           from "@aws-sdk/client-sqs";
import { s3Client } from "../services/generatePreSignedUrl.js";
import { sqsClient }                    from "../services/sqsService.js";
import { Client as OpenSearchClient } from "@opensearch-project/opensearch";
import JobOpening                     from "../models/JobOpening.models.js";

const RESUME_BUCKET   = process.env.AWS_S3_BUCKET_RESUMES;
const RESUME_QUEUE    = process.env.SQS_RESUME_PARSING_QUEUE_URL;
const JWT_SECRET      = process.env.JWT_SECRET;
const JWT_EXPIRES_IN  = process.env.JWT_EXPIRES_IN ?? "1d";
const VALID_STAGES = ["Screening", "Interview", "Offer", "Hired", "Rejected"];


// ─── OpenSearch Client ────────────────────────────────────────────────────────
const esClient = new OpenSearchClient({
  node: process.env.BONSAI_URL,
});

const ES_INDEX = "candidates";

// ─── Helper — sign a candidate JWT ───────────────────────────────────────────
const signToken = (candidate) =>
  jwt.sign(
    {
      id:    candidate._id,
      orgId: candidate.orgId,
      jobId: candidate.jobId,
      type:  "candidate", 
            },        // DISTINGUISH FROM EMPLOYEES TOKEN
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

// ─── POST /api/candidates/signup ─────────────────────────────────────────────
export const signupCandidate = async (req, res) => {
  try {
    const { orgId, jobId, firstName, lastName, email, password } = req.body;

    // ── Input validation ──────────────────────────────────────────────────
    if (!orgId || !jobId || !firstName || !lastName || !email || !password) {
      return res.status(400).json({
        message: "orgId, jobId, firstName, lastName, email and password are all required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    // ── Duplicate check — one application per candidate per job ──────────
    const existing = await Candidate.findOne({
      email: email.toLowerCase().trim(),
      jobId,
    });

    if (existing) {
      return res.status(409).json({
        message: "You have already applied for this position.",
      });
    }

    // ── Explicit password hashing — NOT in pre-save hook ─────────────────
    const salt         = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const candidate = await Candidate.create({
      orgId,
      jobId,
      email:        email.toLowerCase().trim(),
      passwordHash,                              // ← stored explicitly
      profile: {
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
      },
      documents: {
        resumeS3Key: "",                         // ← filled in by submitApplication
      },
      pipeline: {
        currentStage: "Screening",
        status:       "Active",
      },
    });

    const token = signToken(candidate);

    return res.status(201).json({
      success: true,
      message: "Account created. Please complete your application.",
      token,
      candidate: {
        id:        candidate._id,
        email:     candidate.email,
        firstName: candidate.profile.firstName,
        lastName:  candidate.profile.lastName,
      },
    });
  } catch (error) {
    // Mongoose unique index violation (email + jobId)
    if (error.code === 11000) {
      return res.status(409).json({ message: "You have already applied for this position." });
    }
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(", ") });
    }
    console.error("[candidateController] signupCandidate error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── POST /api/candidates/login ───────────────────────────────────────────────
export const loginCandidate = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    // ── Fetch candidate — explicitly include passwordHash (select: false) ─
    const candidate = await Candidate.findOne({
      email: email.toLowerCase().trim(),
    }).select("+passwordHash");

    if (!candidate) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // ── Explicit bcrypt comparison ────────────────────────────────────────
    const isMatch = await bcrypt.compare(password, candidate.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });  // same msg — no enumeration
    }

    // ── Check candidate is still active ──────────────────────────────────
    if (candidate.pipeline.status === "Rejected" || candidate.pipeline.status === "Withdrawn") {
      return res.status(403).json({
        message: "Your application is no longer active.",
        status:  candidate.pipeline.status,
      });
    }

    const token = signToken(candidate);

    return res.status(200).json({
      success: true,
      token,
      candidate: {
        id:           candidate._id,
        email:        candidate.email,
        firstName:    candidate.profile.firstName,
        lastName:     candidate.profile.lastName,
        currentStage: candidate.pipeline.currentStage,
        status:       candidate.pipeline.status,
      },
    });
  } catch (error) {
    console.error("[candidateController] loginCandidate error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── POST /api/candidates/apply  (protected + multipart) ─────────────────────
export const submitApplication = async (req, res) => {
  try {
    // ── req.candidate is set by protectCandidate middleware ───────────────
    const { _id: candidateId, orgId } = req.candidate;

    const { jobId, answers } = req.body;

    if (!jobId) {
      return res.status(400).json({ message: "jobId is required." });
    }

    // ── Resume file check ─────────────────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({ message: "Resume PDF is required." });
    }

    // ── Parse screening question answers ─────────────────────────────────
    let parsedAnswers = [];
    if (answers) {
      try {
        parsedAnswers = JSON.parse(answers);
      } catch {
        return res.status(400).json({ message: "answers must be valid JSON." });
      }
    }

    // ── S3 Upload ─────────────────────────────────────────────────────────
    const s3Key = `resumes/${orgId}/${jobId}/${crypto.randomUUID()}.pdf`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket:               RESUME_BUCKET,
        Key:                  s3Key,
        Body:                 req.file.buffer,
        ContentType:          "application/pdf",
        ServerSideEncryption: "AES256",
        Metadata: {
          candidateId: candidateId.toString(),
          orgId:       orgId.toString(),
          jobId:       jobId.toString(),
        },
      })
    );

    console.log(`[candidateController] Resume uploaded → s3://${RESUME_BUCKET}/${s3Key}`);

    // ── Update Candidate document ─────────────────────────────────────────
    const updatedCandidate = await Candidate.findByIdAndUpdate(
      candidateId,
      {
        $set: {
          jobId,
          questionnaireAnswers:   parsedAnswers.map((a) => ({
            questionId:   a.questionId,
            questionText: a.questionText ?? "",
            answer:       a.answer,
          })),
          "documents.resumeS3Key":   s3Key,
          "pipeline.currentStage":   "Screening",
          "pipeline.status":         "Active",
        },
      },
      { returnDocument: "after" }           
    );

    if (!updatedCandidate) {
      return res.status(404).json({ message: "Candidate not found." });
    }

    // ── SQS — trigger resume parsing worker ──────────────────────────────
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl:    RESUME_QUEUE,
        MessageBody: JSON.stringify({
          candidateId:  candidateId.toString(),
          resumeS3Key:  s3Key,
          orgId:        orgId.toString(),
          jobId:        jobId.toString(),
        }),
      })
    );

    console.log(`[candidateController] Resume parsing job queued for candidate ${candidateId}`);

    return res.status(200).json({
      success: true,
      message: "Application submitted successfully. Your resume is being processed.",
      application: {
        candidateId,
        jobId,
        resumeS3Key:  s3Key,
        currentStage: "Screening",
      },
    });
  } catch (error) {
    console.error("[candidateController] submitApplication error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};


// ─── GET /api/candidates/job/:jobId  (protected — HR/Admin) ──────────────────
/**
 * Returns all candidates for a job, BM25-ranked against the job description.
 *
 * Happy path:
 *   1. Fetch JobOpening → build searchString from title + description + technologies
 *   2. Query OpenSearch (bool: filter jobId+orgId, must match rawText)
 *   3. Build candidateId → _score map from ES hits
 *   4. Fetch candidate documents from MongoDB
 *   5. Inject matchScore, sort descending, return
 *
 * Fallback (OpenSearch unavailable / index missing):
 *   - Log warning, return flat MongoDB list with matchScore: 0
 *
 * @route   GET /api/candidates/job/:jobId
 * @access  Protected — hr_manager / super_admin
 */
export const getCandidatesByJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { orgId } = req.user;

    if (!jobId) {
      return res.status(400).json({ message: "jobId param is required." });
    }

    // ── 1. Fetch job context ───────────────────────────────────────────────
    const job = await JobOpening.findOne({ _id: jobId, orgId }).lean();

    if (!job) {
      return res.status(404).json({ message: "Job opening not found." });
    }

    // Build the BM25 search string from all job signals
    const techNames   = (job.technologies ?? []).map(t => t.name).join(" ");
    const searchString = [job.title, job.description, techNames]
      .filter(Boolean)
      .join(" ");

    // ── 2. Query OpenSearch ───────────────────────────────────────────────
    let scoreMap = new Map(); // candidateId (string) → _score (number)
    let esSucceeded = false;

    try {
      const esResponse = await esClient.search({
        index: ES_INDEX,
        body: {
          size: 1000,   // fetch all candidates for this job — no pagination needed
          _source: false,   // we only need _id and _score, not the stored rawText
          query: {
            bool: {
              // filter → hard security gate — must match both jobId AND orgId
              filter: [
                { term: { jobId: jobId.toString()  } },
                { term: { orgId: orgId.toString()  } },
              ],
              // must → BM25 relevance ranking against the full resume text
              must: [
                {
                  match: {
                    rawText: {
                      query:    searchString,
                      operator: "or",   // candidate scores higher if more terms match
                    },
                  },
                },
              ],
            },
          },
        },
      });

      const hits = esResponse.body?.hits?.hits ?? [];

      hits.forEach(hit => {
        scoreMap.set(hit._id, hit._score ?? 0);
      });

      esSucceeded = true;

      console.log(
        `[candidateController] OpenSearch ranked ${hits.length} candidates ` +
        `| job=${jobId} | org=${orgId}`
      );

    } catch (esError) {
      // Graceful fallback — index may not exist yet if no resumes parsed
      console.warn(
        `[candidateController] OpenSearch unavailable — falling back to MongoDB | ` +
        `reason=${esError.message}`
      );
    }

    // ── 3. Fetch candidate documents from MongoDB ─────────────────────────
    const candidates = await Candidate.find({ jobId, orgId })
      .select("_id profile email pipeline createdAt")
      .lean();

    // ── 4. Inject matchScore + sort ───────────────────────────────────────
    const scored = candidates.map(candidate => {
      const esScore = scoreMap.get(candidate._id.toString()) ?? 0;

      // Normalise to 0-100 range (ES raw scores are unbounded floats)
      // We'll update this to a proper min-max normalisation once we have
      // enough data. For now a simple multiply gives a readable number.
      const matchScore = esSucceeded
        ? Math.min(Math.round(esScore * 10), 100)
        : (candidate.pipeline?.matchScore ?? 0);

      return {
        ...candidate,
        pipeline: {
          ...candidate.pipeline,
          matchScore,
        },
      };
    });

    // Sort by matchScore descending — best candidates at the top of each column
    scored.sort((a, b) => b.pipeline.matchScore - a.pipeline.matchScore);

    return res.status(200).json({
      success:    true,
      count:      scored.length,
      esRanked:   esSucceeded,   // lets the frontend show a "AI ranked" badge
      data:       scored,
    });

  } catch (error) {
    console.error("[candidateController] getCandidatesByJob error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};
// ─── PUT /api/candidates/:id/stage  (protected — HR/Admin) ───────────────────
/**
 * Updates a candidate's pipeline stage.
 * Used by the Kanban board drag-and-drop.
 * Scoped to req.user.orgId — prevents cross-tenant mutations.
 *
 * @route   PUT /api/candidates/:id/stage
 * @access  Protected — hr_manager / super_admin
 */
export const updateCandidateStage = async (req, res) => {
  try {
    const { id }    = req.params;
    const { stage } = req.body;
    const { orgId } = req.user;

    // ── Input validation ───────────────────────────────────────────────────
    if (!stage) {
      return res.status(400).json({ message: "stage is required." });
    }

    if (!VALID_STAGES.includes(stage)) {
      return res.status(400).json({
        message: `Invalid stage. Must be one of: ${VALID_STAGES.join(", ")}.`,
      });
    }

    // ── Find and update — orgId scope prevents cross-tenant mutations ──────
    const candidate = await Candidate.findOneAndUpdate(
      {
        _id:   id,
        orgId,           // ← security: org-scoped update
      },
      {
        $set: { "pipeline.currentStage": stage },
      },
      { returnDocument: "after" }
    ).select("_id profile email pipeline createdAt");

    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found." });
    }

    // TODO: If stage === 'Hired', trigger Employee Onboarding workflow.
    // e.g. await onboardingService.createOnboardingTask(candidate._id, orgId);

    console.log(
      `[candidateController] Stage updated | candidate=${id} | ` +
      `stage=${stage} | org=${orgId}`
    );

    return res.status(200).json({
      success:   true,
      candidate,
    });

  } catch (error) {
    console.error("[candidateController] updateCandidateStage error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};