import "dotenv/config";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
// import { Client as ElasticsearchClient } from "@elastic/elasticsearch";
import { Client as OpenSearchClient } from "@opensearch-project/opensearch";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import connectDB from "../config/db.js";
import mongoose, { connect }                          from "mongoose";
import Candidate                         from "../models/Candidate.models.js";

// ─── AWS Clients ──────────────────────────────────────────────────────────────
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ─── Elasticsearch Client (Bonsai.io) ─────────────────────────────────────────
const esClient = new OpenSearchClient({
  node: process.env.BONSAI_URL,
});

// ─── Constants ────────────────────────────────────────────────────────────────
const QUEUE_URL     = process.env.SQS_RESUME_PARSING_QUEUE_URL;
const RESUME_BUCKET = process.env.AWS_S3_BUCKET_RESUMES;
const ES_INDEX      = "candidates";

// ─── Helper — S3 readable stream → Buffer ─────────────────────────────────────
const streamToBuffer = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data",  chunk => chunks.push(chunk));
    stream.on("end",   ()    => resolve(Buffer.concat(chunks)));
    stream.on("error", err   => reject(err));
  });


// ─── Helper — create index if it doesn't exist ────────────────────────────────
/**
 * Bonsai.io restricts auto_create_index to specific patterns.
 * We must explicitly create the index before the first document is indexed.
 * Uses a simple text mapping for rawText — Elasticsearch BM25 works out of the box.
 */
const ensureIndex = async () => {
  try {
    const exists = await esClient.indices.exists({ index: ES_INDEX });

    if (exists.body === true || exists.statusCode === 200) {
      console.log(`[resumeParser] ES index "${ES_INDEX}" already exists.`);
      return;
    }

    await esClient.indices.create({
      index: ES_INDEX,
      body: {
        settings: {
          number_of_shards:   1,
          number_of_replicas: 0,   // Bonsai free tier — single node, no replicas
        },
        mappings: {
          properties: {
            candidateId:   { type: "keyword" },
            jobId:         { type: "keyword" },
            orgId:         { type: "keyword" },
            pipelineStage: { type: "keyword" },
            indexedAt:     { type: "date"    },
            rawText:       { type: "text",   analyzer: "english" },  // BM25 ranking
          },
        },
      },
    });

    console.log(`[resumeParser] ES index "${ES_INDEX}" created.`);
  } catch (err) {
    // If two worker instances race, one will get a 400 resource_already_exists_exception — safe to ignore
    if (err.body?.error?.type === "resource_already_exists_exception") {
      console.log(`[resumeParser] ES index "${ES_INDEX}" already exists (race condition — safe).`);
      return;
    }
    throw new Error(`Failed to create ES index | reason=${err.message}`);
  }
};

// ─── Core message processor ───────────────────────────────────────────────────
/**
 * Handles one SQS message end-to-end:
 *   1. Parse SQS body
 *   2. Download PDF from S3
 *   3. Extract raw text with pdf-parse
 *   4. Update Candidate.parsedData.rawText in MongoDB
 *   5. Index the candidate document into Elasticsearch (BM25-ready)
 *   6. Delete message from SQS — only after both 4 and 5 succeed
 *
 * Any throw prevents SQS deletion → message returns to queue for retry.
 */
const processMessage = async (message) => {
  // ── 1. Parse SQS message body ──────────────────────────────────────────
  let payload;
  try {
    payload = JSON.parse(message.Body);
  } catch {
    throw new Error(`Invalid JSON in SQS message body: ${message.Body}`);
  }

  const { candidateId, resumeS3Key, orgId, jobId } = payload;

  if (!candidateId || !resumeS3Key) {
    throw new Error(
      `Missing required fields in SQS payload | body=${message.Body}`
    );
  }

  console.log(
    `[resumeParser] Processing  | candidate=${candidateId} | ` +
    `key=${resumeS3Key} | org=${orgId} | job=${jobId}`
  );

  // ── 2. Download PDF from S3 ────────────────────────────────────────────
  const s3Response = await s3Client.send(
    new GetObjectCommand({
      Bucket: RESUME_BUCKET,
      Key:    resumeS3Key,
    })
  );

  const pdfBuffer = await streamToBuffer(s3Response.Body);

  console.log(
    `[resumeParser] S3 download OK | candidate=${candidateId} | ` +
    `size=${pdfBuffer.length} bytes`
  );

  // ── 3. Extract raw text ────────────────────────────────────────────────
  const parsed  = await pdfParse(pdfBuffer);
  const rawText = parsed.text?.trim() ?? "";

  if (!rawText) {
    console.warn(
      `[resumeParser] Warning — empty PDF text | candidate=${candidateId}`
    );
  }

  console.log(
    `[resumeParser] PDF parsed | candidate=${candidateId} | ` +
    `chars=${rawText.length}`
  );

  // ── 4. Persist rawText to MongoDB ─────────────────────────────────────
  const updated = await Candidate.findByIdAndUpdate(
    candidateId,
    {
      $set: {
        "parsedData.rawText": rawText,
      },
    },
    { returnDocument: "after" }
  );

  if (!updated) {
    throw new Error(`Candidate not found in DB | candidateId=${candidateId}`);
  }

  console.log(
    `[resumeParser] MongoDB updated | candidate=${candidateId}`
  );

  // ── 5. Index into Elasticsearch ───────────────────────────────────────
  // Using candidateId as the ES document _id ensures idempotency:
  // if the worker retries the same message, ES will overwrite (not duplicate).
  try {
    await esClient.index({
      index: ES_INDEX,
      id:    candidateId.toString(),
      body: {
        candidateId,
        jobId,
        orgId,
        rawText,
        pipelineStage: updated.pipeline?.currentStage ?? "Screening",
        indexedAt:     new Date().toISOString(),
      },
    });

    console.log(
      `[resumeParser] ES indexed | candidate=${candidateId} | index=${ES_INDEX}`
    );
  } catch (esError) {
    // Throw so SQS message is NOT deleted — worker will retry on next poll
    throw new Error(
      `Elasticsearch indexing failed | candidate=${candidateId} | ` +
      `reason=${esError.message}`
    );
  }

  // ── 6. Delete from SQS — only after both MongoDB and ES succeed ────────
  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl:      QUEUE_URL,
      ReceiptHandle: message.ReceiptHandle,
    })
  );

  console.log(
    `[resumeParser] SQS message deleted | candidate=${candidateId}`
  );
};

// ─── Main worker loop ─────────────────────────────────────────────────────────
/**
 * Runs forever — call once at startup.
 * Long polling (WaitTimeSeconds: 20) keeps idle cost near zero.
 *
 * Failure policy:
 *   - Per-message crash  → log + sleep 5s, message stays in queue for retry
 *   - SQS receive error  → log + sleep 5s, retry the receive on next iteration
 */
export const startResumeWorker = async () => {
  console.log("[resumeParser] Worker starting...");
  console.log(`[resumeParser] Queue  : ${QUEUE_URL}`);
  console.log(`[resumeParser] Bucket : ${RESUME_BUCKET}`);
  console.log(`[resumeParser] ES URL : ${process.env.BONSAI_URL?.split("@")[1] ?? "set"}`);

  // ── MongoDB ───────────────────────────────────────────────────────────
  // if (mongoose.connection.readyState === 0) {
  //   await mongoose.connect(process.env.MONGO_URI);
  //   console.log("[resumeParser] MongoDB connected.");
  // }
  await connectDB() ; 

  // ── Elasticsearch health check ────────────────────────────────────────
  try {
    const health = await esClient.cluster.health();
    console.log(`[resumeParser] Elasticsearch connected`);
    await ensureIndex() ; 
  } catch (err) {
    console.error("[resumeParser] Elasticsearch connection failed:", err.message);
    console.warn("[resumeParser] Continuing — ES errors will surface per-message.");
  }

  console.log("[resumeParser] Polling SQS...\n");

  while (true) {
    try {
      // ── Long-poll SQS ────────────────────────────────────────────────
      const receiveResult = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl:            QUEUE_URL,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds:     20,
        })
      );

      const messages = receiveResult.Messages ?? [];

      if (messages.length === 0) {
        continue;   // long poll timed out — re-poll immediately
      }

      // ── Process single message ───────────────────────────────────────
      try {
        await processMessage(messages[0]);
      } catch (processingError) {
        // Message NOT deleted — visibility timeout will expire and it
        // will return to the queue for another attempt.
        console.error(
          "[resumeParser] Processing failed — message will be retried:",
          processingError.message
        );

        // Back-off to avoid hot-looping on a persistently broken message
        await new Promise(resolve => setTimeout(resolve, 5_000));
      }

    } catch (sqsError) {
      console.error(
        "[resumeParser] SQS receive error — retrying in 5s:",
        sqsError.message
      );
      await new Promise(resolve => setTimeout(resolve, 5_000));
    }
  }
};

startResumeWorker() ; 