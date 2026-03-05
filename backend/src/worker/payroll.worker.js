import mongoose from "mongoose";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import User from "../models/User.models.js";
import Payslip from "../models/Payslip.models.js";
import PayrollBatch from "../models/Payrollbatch.models.js";
import { sqsClient } from "../services/sqsService.js";
import connectDB from "../config/db.js";

import "dotenv/config"; // Ensure env vars are loaded

const QUEUE_URL = process.env.SQS_PAYROLL_QUEUE_URL;

// ── Graceful shutdown flag ────────────────────────────────────────────────────
// When SIGTERM/SIGINT is received (e.g. docker stop, pm2 restart),
// we finish the current message then exit cleanly instead of being killed mid-write
let isShuttingDown = false;

process.on("SIGTERM", () => {
  console.log(
    "[Worker] SIGTERM received — finishing current message then exiting...",
  );
  isShuttingDown = true;
});
process.on("SIGINT", () => {
  console.log(
    "[Worker] SIGINT received — finishing current message then exiting...",
  );
  isShuttingDown = true;
});

// database operation for processing the payroll calculations
// 2. The Core Processing Logic for ONE message
const processMessage = async (messageBody) => {
  let batchId, orgId, year, month, employeeIds;

  // ── Parse payload safely ──────────────────────────────────────────────────
  try {
    ({ batchId, orgId, year, month, employeeIds } = JSON.parse(messageBody));
  } catch (parseErr) {
    // Malformed JSON — log and return false so the message gets deleted
    // (re-queuing a broken message will never succeed)
    console.error("[Worker] Malformed SQS message body:", parseErr.message);
    return false;
  }

  try {
    // A. Fetch the employees' financial data
    const employees = await User.find({ _id: { $in: employeeIds } })
      .select("_id departmentId financial")
      .lean();
    if (employees.length === 0) {
      console.warn(`[Worker] No employees found for ids: ${employeeIds}`);
      // Still increment processedCount so batch completion check works
      await PayrollBatch.updateOne(
        { _id: batchId },
        { $inc: { processedCount: employeeIds.length } },
      );
      return true;
    }
    // B. Build the BulkWrite Array
    const bulkOperations = employees.map((emp) => {
      const baseSalary = emp.financial?.baseSalary || 0;

      // TODO :  Fetch approved unpaid leaves here and calculate deductions
      const tax = 0;
      const healthInsurance = 0;
      const unpaidLeave = 0;

      const netPay = baseSalary - (tax + healthInsurance + unpaidLeave);

      return {
        updateOne: {
          // IDEMPOTENCY: Match exactly on these 4 fields so we never double-pay!
          filter: {
            orgId,
            employeeId: emp._id,
            "payPeriod.month": month,
            "payPeriod.year": year,
          },
          update: {
            $set: {
              departmentId: emp.departmentId,
              earnings: { baseSalary, bonus: 0, allowances: 0 },
              deductions: { tax, healthInsurance, unpaidLeave },
              netPay,
              status: "draft",
            },
          },
          upsert: true, // If it doesn't exist, create it. If it does, overwrite it.
        },
      };
    });

    // C. Execute the massive write to MongoDB in ONE network trip
    if (bulkOperations.length > 0) {
      await Payslip.bulkWrite(bulkOperations);
    }

    // D. Update the Progress Bar Tracker
    await PayrollBatch.updateOne(
      { _id: batchId },
      { $inc: { processedCount: employeeIds.length } }, // Atomic increment!
    );

    // ── E. Check if entire batch is now complete ──────────────────────────────
    // Fetch fresh — another worker chunk may have just finished too
    const batch = await PayrollBatch.findById(batchId)
      .select("totalEmployees processedCount failedCount")
      .lean();

    if (batch) {
      const totalHandled =
        (batch.processedCount ?? 0) + (batch.failedCount ?? 0);
      if (totalHandled >= batch.totalEmployees) {
        const finalStatus =
          (batch.failedCount ?? 0) === 0
            ? "completed"
            : "completed_with_errors";
        await PayrollBatch.updateOne(
          { _id: batchId },
          {
            status: finalStatus,
            completedAt: new Date(),
          },
        );
        console.log(
          `[Worker] Batch ${batchId} — ${finalStatus} (${batch.totalEmployees} employees)`,
        );
      }
    }

    console.log(
      ` [Worker] Processed ${employeeIds.length} payslips for Batch ${batchId}`,
    );
    return true; // Success!
  } catch (error) {
    console.error(
      ` [Worker Error] Failed to process chunk for Batch ${batchId}:`,
      error,
    );

    // If a chunk fails, log it in the tracker so HR knows exactly who failed
    await PayrollBatch.updateOne(
      { _id: batchId },
      {
        $inc: { failedCount: employeeIds.length },
        $addToSet: { failedEmployeeIds: { $each: employeeIds } },
      },
    );
    return false; // Failed, but we handled it gracefully.
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// deleteMessage — removes message from SQS after successful or failed processing
// CRITICAL — if skipped, SQS re-delivers after visibilityTimeout → double pay
// ─────────────────────────────────────────────────────────────────────────────
const deleteMessage = async (receiptHandle) => {
  try {
    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: receiptHandle,
      }),
    );
  } catch (err) {
    // Non-fatal — SQS will re-deliver but idempotent bulkWrite handles it safely
    console.error("[Worker] Failed to delete SQS message:", err.message);
  }
};

export const startWorker = async () => {
  await connectDB();

  console.log("Listening for Payroll SQS messages...");
  // infinite polling loop
  // efficient way - use aws lambda functions instead of worker
  while (!isShuttingDown) {
    try {
      const response = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: QUEUE_URL,
          MaxNumberOfMessages: 1, // Pull 1 chunk at a time                    
        }),
      );

      const messages = response?.Messages;
      if (!messages || messages.length === 0) {
        // No messages — loop again (WaitTimeSeconds already handled the pause)
        continue;
      }

      const message = messages[0];
      console.log(`[Worker] 📨 Received message ${message.MessageId}`);

      // ── Process the payload ────────────────────────────────────────────────
      const isSuccess = await processMessage(message.Body);
      await deleteMessage(message.ReceiptHandle);
        if (isSuccess) {
        console.log(`[Worker]  Message ${message.MessageId} processed and deleted`);
      } else {
        console.warn(`[Worker]   Message ${message.MessageId} failed gracefully and deleted (check failedEmployeeIds)`);
      }

    } catch (pollErr) {
      console.error("[Worker] SQS poll error:", pollErr.message);
      // Back off before retrying to avoid hammering SQS on persistent errors
      // (e.g. network blip, SQS throttle)
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }

  // ── Clean shutdown ──────────────────────────────────────────────────────────
  console.log("[Worker] Shutting down cleanly...");
  await mongoose.disconnect();
  process.exit(0);
};

startWorker() ; 
