import "dotenv/config";
import mongoose from "mongoose";
import puppeteer, { executablePath } from "puppeteer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { sqsClient } from "../services/sqsService.js";
import Payslip from "../models/Payslip.models.js";
import connectDB from "../config/db.js";
import User           from "../models/User.models.js";

// ─── Configuration ────────────────────────────────────────────────────────────
const QUEUE_URL = process.env.SQS_HR_PDF_URL;
const S3_BUCKET = process.env.AWS_S3_BUCKET_HR_PAYSLIPS;

if (!QUEUE_URL) throw new Error("SQS_HR_PDF_URL is not set in environment.");
if (!S3_BUCKET)
  throw new Error("AWS_S3_BUCKET_HR_PAYSLIPS is not set in environment.");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ─── Global State ─────────────────────────────────────────────────────────────
let isShuttingDown = false;
let browser = null; // single browser instance — reused across all messages

// ─── HTML Template ────────────────────────────────────────────────────────────
// Generates a clean A4-ready HTML string from a populated Payslip document.
// Tailwind is loaded via CDN — Puppeteer waits for networkidle0 before printing.
const buildPayslipHtml = (payslip) => {
  const emp = payslip.employeeId;

  const firstName = emp?.profile?.firstName ?? "N/A";
  const lastName = emp?.profile?.lastName ?? "";
  const email = emp?.email ?? "N/A";
  const displayId = emp?.displayId ?? "—";
  const fullName = `${firstName} ${lastName}`.trim();

  const month = payslip.payPeriod.month;
  const year = payslip.payPeriod.year;

  const monthLabel = new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
  });

  const paymentDate = payslip.paymentDate
    ? new Date(payslip.paymentDate).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "N/A";

  const fmt = (n) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(n ?? 0);

  const baseSalary = payslip.earnings?.baseSalary ?? 0;
  const bonus = payslip.earnings?.bonus ?? 0;
  const allowances = payslip.earnings?.allowances ?? 0;
  const tax = payslip.deductions?.tax ?? 0;
  const healthInsurance = payslip.deductions?.healthInsurance ?? 0;
  const unpaidLeave = payslip.deductions?.unpaidLeave ?? 0;
  const grossPay = payslip.grossPay ?? baseSalary + bonus + allowances;
  const totalDeductions = tax + healthInsurance + unpaidLeave;
  const netPay = payslip.netPay ?? grossPay - totalDeductions;
  const appliedTaxPct = payslip.appliedTaxPct ?? 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payslip - ${fullName} - ${monthLabel} ${year}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* Force A4 dimensions and prevent Puppeteer from adding default margins */
    @page { size: A4; margin: 0; }
    body  { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body class="bg-white font-sans text-gray-800 p-10 w-[794px] min-h-[1123px]">

  <!-- Header -->
  <div class="flex items-start justify-between border-b-2 border-gray-900 pb-6 mb-8">
    <div>
      <h1 class="text-2xl font-extrabold text-gray-900 tracking-tight">Nexus HR</h1>
      <p class="text-sm text-gray-500 mt-1">Confidential — Employee Payslip</p>
    </div>
    <div class="text-right">
      <p class="text-4xl font-black tracking-widest text-gray-800 uppercase">Payslip</p>
      <p class="text-base font-semibold text-gray-500 mt-1">${monthLabel} ${year}</p>
    </div>
  </div>

  <!-- Employee + Pay Period Info -->
  <div class="grid grid-cols-2 gap-6 bg-gray-50 rounded-xl px-6 py-5 mb-8 border border-gray-200">
    <div>
      <p class="text-xs uppercase tracking-widest text-gray-400 font-bold mb-2">Employee Details</p>
      <p class="text-lg font-bold text-gray-900">${fullName}</p>
      <p class="text-sm text-gray-500 mt-0.5">${email}</p>
      <p class="text-sm text-gray-400 mt-0.5">ID: ${displayId}</p>
    </div>
    <div class="text-right">
      <p class="text-xs uppercase tracking-widest text-gray-400 font-bold mb-2">Pay Period</p>
      <p class="text-lg font-bold text-gray-900">${monthLabel} ${year}</p>
      <p class="text-sm text-gray-500 mt-0.5">Payment Date: ${paymentDate}</p>
      <p class="text-sm text-gray-400 mt-0.5">Applied Tax Rate: ${appliedTaxPct}%</p>
    </div>
  </div>

  <!-- Earnings and Deductions Side by Side -->
  <div class="grid grid-cols-2 gap-8 mb-8">

    <!-- Earnings -->
    <div>
      <h2 class="text-xs uppercase tracking-widest font-bold text-gray-400 mb-3">Earnings</h2>
      <div class="space-y-0 border border-gray-200 rounded-lg overflow-hidden">
        ${[
          ["Base Salary", fmt(baseSalary)],
          ["Bonus", fmt(bonus)],
          ["Allowances", fmt(allowances)],
        ]
          .map(
            ([label, value], idx, arr) => `
        <div class="flex justify-between px-4 py-3 text-sm
          ${idx < arr.length - 1 ? "border-b border-gray-100" : ""} bg-white">
          <span class="text-gray-600">${label}</span>
          <span class="font-medium text-gray-900">${value}</span>
        </div>`,
          )
          .join("")}
      </div>
      <!-- Gross Total -->
      <div class="flex justify-between px-4 py-3 mt-2 bg-green-50
                  border border-green-200 rounded-lg text-sm">
        <span class="font-bold text-green-800">Gross Pay</span>
        <span class="font-extrabold text-green-800">${fmt(grossPay)}</span>
      </div>
    </div>

    <!-- Deductions -->
    <div>
      <h2 class="text-xs uppercase tracking-widest font-bold text-gray-400 mb-3">Deductions</h2>
      <div class="space-y-0 border border-gray-200 rounded-lg overflow-hidden">
        ${[
          ["Income Tax", fmt(tax)],
          ["Health Insurance", fmt(healthInsurance)],
          ["Unpaid Leave", fmt(unpaidLeave)],
        ]
          .map(
            ([label, value], idx, arr) => `
        <div class="flex justify-between px-4 py-3 text-sm
          ${idx < arr.length - 1 ? "border-b border-gray-100" : ""} bg-white">
          <span class="text-gray-600">${label}</span>
          <span class="font-medium text-red-600">${value}</span>
        </div>`,
          )
          .join("")}
      </div>
      <!-- Total Deductions -->
      <div class="flex justify-between px-4 py-3 mt-2 bg-red-50
                  border border-red-200 rounded-lg text-sm">
        <span class="font-bold text-red-800">Total Deductions</span>
        <span class="font-extrabold text-red-800">${fmt(totalDeductions)}</span>
      </div>
    </div>
  </div>

  <!-- Divider -->
  <div class="border-t-2 border-dashed border-gray-200 my-6"></div>

  <!-- Net Pay Banner -->
  <div class="flex items-center justify-between bg-gray-900 text-white
              rounded-xl px-8 py-6 mb-8">
    <div>
      <p class="text-xs uppercase tracking-widest text-gray-400 font-bold mb-1">Take-Home Pay</p>
      <p class="text-2xl font-black tracking-tight">Net Pay</p>
    </div>
    <p class="text-4xl font-black tracking-tight">${fmt(netPay)}</p>
  </div>

  <!-- Breakdown Summary Table -->
  <div class="mb-8">
    <h2 class="text-xs uppercase tracking-widest font-bold text-gray-400 mb-3">Summary</h2>
    <table class="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
      <thead class="bg-gray-50">
        <tr>
          <th class="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Component</th>
          <th class="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
          <th class="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100 bg-white">
        ${[
          ["Base Salary", fmt(baseSalary), "Earning", "text-green-700"],
          ["Bonus", fmt(bonus), "Earning", "text-green-700"],
          ["Allowances", fmt(allowances), "Earning", "text-green-700"],
          ["Income Tax", fmt(tax), "Deduction", "text-red-600"],
          [
            "Health Insurance",
            fmt(healthInsurance),
            "Deduction",
            "text-red-600",
          ],
          ["Unpaid Leave", fmt(unpaidLeave), "Deduction", "text-red-600"],
        ]
          .map(
            ([label, value, type, color]) => `
        <tr>
          <td class="px-4 py-2.5 text-gray-700">${label}</td>
          <td class="px-4 py-2.5 text-right font-medium ${color}">${value}</td>
          <td class="px-4 py-2.5 text-right text-xs text-gray-400">${type}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="text-center border-t border-gray-200 pt-6">
    <p class="text-xs text-gray-400">
      This is a system-generated payslip issued by Nexus HR and does not require a physical signature.
    </p>
    <p class="text-xs text-gray-300 mt-1">
      Generated on ${new Date().toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}
    </p>
  </div>

</body>
</html>`;
};

// ─── Process a Single Payslip Message ────────────────────────────────────────
// Opens a new Puppeteer PAGE (not a new browser), generates the PDF, uploads
// to S3, updates MongoDB, then closes the page.  The browser is reused.
// ─── Process a Single Payslip Message ────────────────────────────────────────
const processMessage = async (message) => {
  let page = null;

  const { paySlipId } = JSON.parse(message.Body);

  if (!paySlipId) {
    throw new Error("Message body is missing paySlipId field.");
  }

  console.log(`[PDF Worker] Processing payslip: ${paySlipId}`);

  try {
    const payslip = await Payslip.findById(paySlipId)
      .populate("employeeId", "profile.firstName profile.lastName email displayId")
      .lean();

    if (!payslip) {
      throw new Error(`Payslip ${paySlipId} not found in database.`);
    }

    const orgId  = payslip.orgId.toString();
    const year   = payslip.payPeriod.year;
    const month  = String(payslip.payPeriod.month).padStart(2, "0");
    const s3Key  = `payslips/${orgId}/${year}/${month}/${paySlipId}.pdf`;

    const html = buildPayslipHtml(payslip);

    // Open a page scoped INSIDE try so finally can always close it
    page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: "networkidle2", timeout: 60_000 });

    const pdfBuffer = await page.pdf({
      format:          "A4",
      printBackground: true,
      margin:          { top: "0", right: "0", bottom: "0", left: "0" },
    });

    await s3Client.send(
      new PutObjectCommand({
        Bucket:               S3_BUCKET,
        Key:                  s3Key,
        Body:                 pdfBuffer,
        ContentType:          "application/pdf",
        ServerSideEncryption: "AES256", 
        Metadata: {
          payslipId: paySlipId,
          orgId,
          month:     String(payslip.payPeriod.month),
          year:      String(year),
        },
      }),
    );

    console.log(`[PDF Worker] Uploaded to S3: ${s3Key}`);

    await Payslip.findByIdAndUpdate(paySlipId, { $set: { s3Key } });

    console.log(`[PDF Worker] Database updated for payslip: ${paySlipId}`);

  } finally {
    // ONLY close THIS message's page — never touch other pages
    if (page && !page.isClosed()) {
      await page.close().catch(() => {});
    }
  }
};


// ─── Main Polling Loop ────────────────────────────────────────────────────────
const startWorker = async () => {
  // -- Connect to MongoDB first ------------------------------------------------
  await connectDB();

  // -- Launch the global Puppeteer browser ONCE --------------------------------
  // These flags are mandatory when running on Linux servers (EC2, Render, etc.)
  browser = await puppeteer.launch({
    headless: true,   
     executablePath: puppeteer.executablePath(),   //  forces arm64 Chrome on Mac Silicon`
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", // prevents /dev/shm OOM crashes on small VMs
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
    ],
  });

  console.log("[PDF Worker] Worker started — polling SQS for PDF jobs...");
  console.log("[PDF Worker] Queue URL:", QUEUE_URL);

  // -- Graceful shutdown -------------------------------------------------------
  const shutdown = async (signal) => {
    console.log(
      `[PDF Worker] Received ${signal} — shutting down gracefully...`,
    );
    isShuttingDown = true;

    if (browser) {
      await browser.close().catch(() => {});
      console.log("[PDF Worker] Puppeteer browser closed.");
    }

    await mongoose.disconnect();
    console.log("[PDF Worker] MongoDB disconnected. Exiting.");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // -- Poll loop ---------------------------------------------------------------
  while (!isShuttingDown) {
    try {
      const response = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: QUEUE_URL,
          MaxNumberOfMessages: 10, // process up to 10 payslips per batch
          WaitTimeSeconds: 20, // long polling — reduces empty calls
          VisibilityTimeout: 120, // 2 min — enough for Puppeteer + S3 upload
        }),
      );

      const messages = response?.Messages;

      if (!messages || messages.length === 0) {
        // No messages — long poll returned empty, just loop again
        continue;
      }

      console.log(`[PDF Worker] Received ${messages.length} message(s).`);

      // Process messages SEQUENTIALLY — prevents Puppeteer page race conditions.
      // On a production server with more RAM you can increase this to 3-5.
      for (const message of messages) {
        if (isShuttingDown) break;

        try {
          await processMessage(message);

          await sqsClient.send(
            new DeleteMessageCommand({
              QueueUrl:      QUEUE_URL,
              ReceiptHandle: message.ReceiptHandle,
            }),
          );

          console.log(
            `[PDF Worker] Message ${message.MessageId} processed and deleted.`,
          );
        } catch (err) {
          console.error(
            `[PDF Worker] Failed to process message ${message.MessageId}:`,
            err.message,
          );
        }
      }

    } catch (err) {
      if (isShuttingDown) break;

      // SQS connectivity error — wait before retrying to avoid a tight crash loop
      console.error("[PDF Worker] SQS poll error:", err.message);
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
};

// ─── Entry Point ──────────────────────────────────────────────────────────────
startWorker().catch((err) => {
  console.error("[PDF Worker] Fatal startup error:", err);
  process.exit(1);
});
