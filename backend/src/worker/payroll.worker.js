import mongoose from "mongoose";
import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import User                     from "../models/User.models.js";
import Payslip                  from "../models/Payslip.models.js";
import PayrollBatch             from "../models/Payrollbatch.models.js";
import MonthlyDepartmentSummary from "../models/analytics/MonthlyDepartmentSummary.models.js";
import { sqsClient }            from "../services/sqsService.js";
import connectDB                from "../config/db.js";
import "dotenv/config";

const QUEUE_URL = process.env.SQS_PAYROLL_QUEUE_URL;

let isShuttingDown = false;
process.on("SIGTERM", () => { isShuttingDown = true; });
process.on("SIGINT",  () => { isShuttingDown = true; });

// ─────────────────────────────────────────────────────────────────────────────
// checkAndFinalizeBatch — Evaluates if the batch is 100% done and triggers summary
// ─────────────────────────────────────────────────────────────────────────────
const checkAndFinalizeBatch = async (batchId, orgId, month, year) => {
  try {
    const batch = await PayrollBatch.findById(batchId)
      .select("totalEmployees processedCount failedCount, payPeriod")
      .lean();

    if (!batch) return;

    const totalHandled = (batch.processedCount ?? 0) + (batch.failedCount ?? 0);

    // If we have processed or failed ALL employees, wrap it up!
    if (totalHandled >= batch.totalEmployees) {
      const finalStatus = (batch.failedCount ?? 0) === 0 ? "completed" : "completed_with_errors";

      await PayrollBatch.updateOne(
        { _id: batchId },
        {$set: {status: finalStatus, completedAt: new Date()}}
      );

      console.log(`[Worker] Batch ${batchId} — ${finalStatus} (${batch.totalEmployees} employees)`);

      // ── Materialize the analytics summary only on full success ──
      if (finalStatus === "completed") {
        const batchMonth = batch.payPeriod.month; 
        const batchYear = batch.payPeriod.year ; 

        console.log(`[Worker] Generating materialized report for ${month}/${year}...`);
        await generateMaterializedSummary(orgId, batchMonth, batchYear);
        console.log(`[Worker] Materialized report done!`);
      }
    }
  } catch (error) {
    console.error(`[Worker] Error finalizing batch ${batchId}:`, error.message);
     console.error(error.stack); 
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// THE CALCULATION ENGINE
// All math runs inside MongoDB — zero Node.js memory bloat
// ─────────────────────────────────────────────────────────────────────────────
const calculatePayroll = async (employeeIds) => {
  return User.aggregate([

    // ── Stage 1: Narrow down to this chunk's employees only ──────────────────
    {
      $match: {
        _id: { $in: employeeIds.map(id => new mongoose.Types.ObjectId(id)) },
      },
    },

    // ── Stage 2: Join Department to get payrollSettings ──────────────────────
    // LEFT join — employees with no department still come through (as empty array)
    {
      $lookup: {
        from:         "departments",   // MongoDB collection name (lowercased plural)
        localField:   "departmentId",
        foreignField: "_id",
        as:           "department",
      },
    },

    // ── Stage 3: Flatten the department array ────────────────────────────────
    // preserveNullAndEmptyArrays: true means employees with NO department
    // are kept rather than dropped — their dept fields just become null
    {
      $unwind: {
        path:                       "$department",
        preserveNullAndEmptyArrays: true,
      },
    },

    // ── Stage 4: THE MATH — all calculations as MongoDB expressions ──────────
    {
      $addFields: {

        // gross = baseSalary + bonusThisMonth
        // $ifNull guards against missing fields — defaults to 0
        _grossPay: {
          $add: [
            { $ifNull: ["$financial.baseSalary",      0] },
            { $ifNull: ["$financial.bonusThisMonth",  0] },
          ],
        },

        // Tax % — use employee's custom rate if set, else fall back to dept default
        // $cond: if customTaxPercentage !== null → use it, else use dept default
        _appliedTaxPct: {
          $cond: {
            if:   { $ne: [{ $ifNull: ["$financial.customTaxPercentage", null] }, null] },
            then: "$financial.customTaxPercentage",
            else: { $ifNull: ["$department.payrollSettings.defaultTaxPercentage", 0] },
          },
        },

        // Health insurance — employee custom flat rate overrides dept flat rate
        _healthInsurance: {
          $cond: {
            if:   { $ne: [{ $ifNull: ["$financial.customHealthInsurance", null] }, null] },
            then: "$financial.customHealthInsurance",
            else: { $ifNull: ["$department.payrollSettings.healthInsuranceFlatRate", 0] },
          },
        },

        // Unpaid leave deduction = days * perDayRate (from dept settings)
        _unpaidLeaveDeduction: {
          $multiply: [
            { $ifNull: ["$financial.unpaidLeaveDaysThisMonth",            0] },
            { $ifNull: ["$department.payrollSettings.unpaidLeaveDeductionPerDay", 0] },
          ],
        },
      },
    },

    // ── Stage 5: Use the intermediate fields to compute tax + netPay ─────────
    // Split into a second $addFields so we can reference _grossPay and _appliedTaxPct
    {
      $addFields: {

        // taxAmount = grossPay × (taxPct / 100)
        _taxAmount: {
          $multiply: [
            "$_grossPay",
            { $divide: ["$_appliedTaxPct", 100] },
          ],
        },
      },
    },

    // ── Stage 6: Final netPay = grossPay - (tax + health + unpaidLeave) ──────
    {
      $addFields: {
        _netPay: {
          $subtract: [
            "$_grossPay",
            {
              $add: [
                "$_taxAmount",
                "$_healthInsurance",
                "$_unpaidLeaveDeduction",
              ],
            },
          ],
        },
      },
    },

    // ── Stage 7: Clean output — only return what we need ────────────────────
    {
      $project: {
        _id:          1,
        departmentId: 1,

        // Monthly variables — needed to decide whether to reset them
        bonusThisMonth:           "$financial.bonusThisMonth",
        unpaidLeaveDaysThisMonth: "$financial.unpaidLeaveDaysThisMonth",

        // Structured exactly as the Payslip schema expects
        earnings: {
          baseSalary: { $ifNull: ["$financial.baseSalary", 0] },
          bonus:      { $ifNull: ["$financial.bonusThisMonth", 0] },
          allowances: {$literal: 0},
        },
        deductions: {
          tax:             { $round: ["$_taxAmount",            2] },
          healthInsurance: { $round: ["$_healthInsurance",      2] },
          unpaidLeave:     { $round: ["$_unpaidLeaveDeduction", 2] },
        },
        netPay:       { $round: ["$_netPay",    2] },
        grossPay:     { $round: ["$_grossPay",  2] },
        appliedTaxPct: "$_appliedTaxPct",
      },
    },
  ]);
};

// ─────────────────────────────────────────────────────────────────────────────
// processMessage — called once per SQS message (one chunk of employees)
// ─────────────────────────────────────────────────────────────────────────────
const processMessage = async (messageBody) => {
  let batchId, orgId, year, month, employeeIds;

  try {
    ({ batchId, orgId, year, month, employeeIds } = JSON.parse(messageBody));
  } catch (parseErr) {
    console.error("[Worker] Malformed SQS message body:", parseErr.message);
    return false;
  }

  //  Cast ONCE at entry point — use orgIdObj everywhere that hits MongoDB
  const orgIdObj = new mongoose.Types.ObjectId(orgId);

  console.log(
    `[Worker] Processing chunk — batchId=${batchId} | employees=${employeeIds.length} | ${month}/${year}`
  );

  try {
    const calculated = await calculatePayroll(employeeIds);

    if (calculated.length === 0) {
      console.warn(`[Worker] No employees found for ids: ${employeeIds}`);
      await PayrollBatch.updateOne(
        { _id: batchId },
        { $inc: { processedCount: employeeIds.length } }
      );
      await checkAndFinalizeBatch(batchId, orgId, month, year);
      return true;
    }

    const payslipOps   = [];
    const userResetOps = [];

    for (const emp of calculated) {
      payslipOps.push({
        updateOne: {
          filter: {
            orgId:             orgIdObj,   //  ObjectId — was plain string before
            employeeId:        emp._id,
            "payPeriod.month": month,
            "payPeriod.year":  year,
          },
          update: {
            $set: {
              batchId,
              departmentId:  emp.departmentId ?? null,
              earnings:      emp.earnings,
              deductions:    emp.deductions,
              netPay:        emp.netPay,
              grossPay:      emp.grossPay,      
              appliedTaxPct: emp.appliedTaxPct,   
              status:        "draft",
              processedAt:   new Date(),
    
            },
            $setOnInsert: {
              orgId:             orgIdObj,
              employeeId:        emp._id,
              "payPeriod.month": month,
              "payPeriod.year":  year,
            },
          },
          upsert: true,
        },
      });

      const needsReset =
        (emp.bonusThisMonth           ?? 0) > 0 ||
        (emp.unpaidLeaveDaysThisMonth ?? 0) > 0;

      if (needsReset) {
        userResetOps.push({
          updateOne: {
            filter: { _id: emp._id },
            update: {
              $set: {
                "financial.bonusThisMonth":           0,
                "financial.unpaidLeaveDaysThisMonth": 0,
              },
            },
          },
        });
      }
    }

    const [payslipResult] = await Promise.all([
      payslipOps.length > 0
        ? Payslip.bulkWrite(payslipOps, { ordered: false })
        : Promise.resolve(null),

      userResetOps.length > 0
        ? User.bulkWrite(userResetOps, { ordered: false })
        : Promise.resolve(null),
    ]);

    console.log(
      `[Worker]  ${calculated.length} payslips written | ${userResetOps.length} monthly vars reset`
    );


    await PayrollBatch.updateOne(
      { _id: batchId },
      { $inc: { processedCount: calculated.length } }
    );
    await checkAndFinalizeBatch(batchId, orgId, month, year);

    return true;

  } catch (error) {
    console.error(`[Worker]  Chunk failed for batch ${batchId}:`, error.message);

    await PayrollBatch.updateOne(
      { _id: batchId },
      {
        $inc:      { failedCount: employeeIds.length },
        $addToSet: { failedEmployeeIds: { $each: employeeIds } },
      }
    ).catch(e => console.error("[Worker] Failed to update failedCount:", e.message));

    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// generateMaterializedSummary — aggregates payslips → MonthlyDepartmentSummary
// ─────────────────────────────────────────────────────────────────────────────
const generateMaterializedSummary = async (orgId, month, year) => {
  try {
    const reportData = await Payslip.aggregate([
      {
        $match: {
          orgId:             new mongoose.Types.ObjectId(orgId),
          "payPeriod.month": month,
          "payPeriod.year":  year,
          //  Only include payslips that have a valid departmentId
          departmentId:      { $ne: null },
        },
      },
      {
        $group: {
          _id:           "$departmentId",
          totalNetPay:   { $sum: "$netPay" },
          totalGrossPay: {
            $sum: {
              $add: [
                "$earnings.baseSalary",
                "$earnings.bonus",
                "$earnings.allowances",
              ],
            },
          },
          totalTaxes:    { $sum: "$deductions.tax" },
          employeeCount: { $sum: 1 },
        },
      },
    ]);

    if (reportData.length === 0) return;

    const bulkOps = reportData.map(dept => ({
      updateOne: {
        filter: {
          orgId:        new mongoose.Types.ObjectId(orgId),
          departmentId: dept._id,
          month,
          year,
        },
        update: {
          $set: {
            totalNetPay:   dept.totalNetPay,
            totalGrossPay: dept.totalGrossPay,
            totalTaxes:    dept.totalTaxes,
            employeeCount: dept.employeeCount,
          },
        },
        upsert: true,
      },
    }));

    await MonthlyDepartmentSummary.bulkWrite(bulkOps, { ordered: false });

  } catch (error) {
    console.error("[Worker] Failed to generate materialized summary:", error.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// deleteMessage
// ─────────────────────────────────────────────────────────────────────────────
const deleteMessage = async (receiptHandle) => {
  try {
    await sqsClient.send(
      new DeleteMessageCommand({ QueueUrl: QUEUE_URL, ReceiptHandle: receiptHandle })
    );
  } catch (err) {
    console.error("[Worker] Failed to delete SQS message:", err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// startWorker — long-poll loop
// ─────────────────────────────────────────────────────────────────────────────
export const startWorker = async () => {
  await connectDB();
  console.log("[Worker] Payroll worker started — polling SQS...");

  while (!isShuttingDown) {
    try {
      const response = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl:            QUEUE_URL,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds:     20,
          VisibilityTimeout:   120,
        })
      );

      const messages = response?.Messages;
      if (!messages || messages.length === 0) continue;

      const message = messages[0];
      console.log(`[Worker]  Received message ${message.MessageId}`);

      const isSuccess = await processMessage(message.Body);
      await deleteMessage(message.ReceiptHandle);

      if (isSuccess) {
        console.log(`[Worker]  Message ${message.MessageId} processed and deleted`);
      } else {
        console.warn(`[Worker]   Message ${message.MessageId} failed gracefully and deleted`);
      }

    } catch (pollErr) {
      console.error("[Worker] SQS poll error:", pollErr.message);
      await new Promise(resolve => setTimeout(resolve, 5_000));
    }
  }

  console.log("[Worker] Shutting down cleanly...");
  await mongoose.disconnect();
  process.exit(0);
};

startWorker();
