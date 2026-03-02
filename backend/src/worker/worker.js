import mongoose from 'mongoose';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import 'dotenv/config';

import { updateMonthlyTrend     } from './processor.js';
import { updateRetentionCohorts } from './processor.js';

// ── SQS client ────────────────────────────────────────────────────────────────
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const QUEUE_URL = process.env.SQS_ANALYTICS_QUEUE_URL;

// ─────────────────────────────────────────────────────────────────────────────
// processMessage — handles exactly one SQS message
//
// Routing table:
//   LEAVE_APPROVED       → updateMonthlyTrend(orgId, yearMonth)
//   EMPLOYEE_HIRED       → updateRetentionCohorts(orgId)
//   EMPLOYEE_TERMINATED  → updateRetentionCohorts(orgId)
//
// The message is only deleted AFTER the processor succeeds.
// If the processor throws, we intentionally skip the delete so SQS will
// re-deliver the message after the VisibilityTimeout expires (2 min).
// ─────────────────────────────────────────────────────────────────────────────
const processMessage = async (message) => {
  const { orgId, eventType, yearMonth, timestamp } = JSON.parse(message.Body);

  console.log(
    `[Worker] 📨 Received | type=${eventType} orgId=${orgId} yearMonth=${yearMonth ?? 'N/A'} enqueued=${timestamp}`
  );

  // ── Route to the correct processor ────────────────────────────────────────
  switch (eventType) {
    case 'LEAVE_APPROVED':
      if (!yearMonth) {
        // Malformed message — delete it immediately, retrying won't fix it
        console.warn(`[Worker]  LEAVE_APPROVED missing yearMonth — discarding message`);
        break;
      }
      await updateMonthlyTrend(orgId, yearMonth);
      break;

    case 'EMPLOYEE_HIRED':
    case 'EMPLOYEE_TERMINATED':
      await updateRetentionCohorts(orgId);
      break;

    default:
      // Unknown event type — discard immediately so it doesn't loop forever
      console.warn(`[Worker]   Unknown eventType="${eventType}" — discarding message`);
      break;
  }

  // ── Delete ONLY after successful processing ────────────────────────────────
  // If an exception was thrown above, we never reach this line.
  // SQS will re-deliver the message after VisibilityTimeout (120s).
  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl:      QUEUE_URL,
      ReceiptHandle: message.ReceiptHandle,
    })
  );

  console.log(`[Worker]  Processed & deleted | type=${eventType} orgId=${orgId}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// pollQueue — long-polling loop, runs indefinitely
//
// Long polling config rationale:
//   WaitTimeSeconds: 20   → SQS holds the connection for up to 20s waiting
//                           for a message — eliminates empty receives 
//                         
//   MaxNumberOfMessages: 5 → Process up to 5 messages per receive call.
//                            Each is processed sequentially to avoid
//                            overwhelming MongoDB with concurrent pipelines.
//
//   VisibilityTimeout: 120 → Our processor pipelines should finish well under
//                            2 minutes. If the worker crashes mid-process,
//                            SQS re-delivers after 120s automatically.
// ─────────────────────────────────────────────────────────────────────────────
const pollQueue = async () => {
  console.log('[Worker]  Poll loop started — waiting for messages...');

  while (true) {
    try {
      const response = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl:            QUEUE_URL,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds:     20,   // long polling — blocks up to 20s
          VisibilityTimeout:   120,  // 2 min window to process before re-delivery
          AttributeNames:      ['All'],
          MessageAttributeNames: ['All'],
        })
      );

      const messages = response.Messages ?? [];

      if (messages.length === 0) {
        // Normal — long poll returned with no messages (queue is empty)
        console.log('[Worker]  No messages — polling again...');
        continue;
      }

      console.log(`[Worker]  Received ${messages.length} message(s)`);

      // ── Process sequentially — prevents N concurrent MongoDB aggregations ──
      // If you need higher throughput, switch to Promise.allSettled(messages.map(...))
      for (const message of messages) {
        try {
          await processMessage(message);
        } catch (msgErr) {
          // Per-message error — log it, do NOT delete, let SQS retry.
          // The outer loop must continue to process other messages in this batch.
          console.error(
            `[Worker]  Message processing failed | ReceiptHandle=${message.ReceiptHandle?.slice(0, 30)}... | ${msgErr.message}`
          );
          console.error(msgErr.stack);

          // Brief delay before next message to prevent hammering MongoDB
          // when it's down — avoids tight error loop
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

    } catch (pollErr) {
      // SQS receive call itself failed (network issue, auth error, etc.)
      // Wait 5s before retrying to avoid hammering AWS on persistent failures
      console.error(`[Worker]  SQS poll failed: ${pollErr.message}`);
      console.error(pollErr.stack);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap — connect to MongoDB then start polling
//
// The worker is a standalone process (node src/worker/worker.js).
// It does NOT import the Express app — it only needs Mongoose + SQS.
// ─────────────────────────────────────────────────────────────────────────────
const bootstrap = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // Optimized for a long-running worker process
      maxPoolSize:        5,   // worker doesn't need a large connection pool
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS:    45000,
    });

    console.log(`[Worker]  MongoDB connected → ${process.env.MONGO_URI}`);

    // Graceful shutdown — release DB connection on SIGTERM (Docker / PM2)
    process.on('SIGTERM', async () => {
      console.log('[Worker]  SIGTERM received — closing MongoDB connection...');
      await mongoose.connection.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('[Worker]  SIGINT received — closing MongoDB connection...');
      await mongoose.connection.close();
      process.exit(0);
    });

    // Start the infinite poll loop
    await pollQueue();

  } catch (err) {
    console.error(`[Worker]  Bootstrap failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
};

bootstrap();