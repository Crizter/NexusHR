
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient } from "./sqsService.js";

export const dispatchPayrollToSQS = async (
  batchId,
  orgId,
  employeeIds,
  year,
  month,
) => {
  const queueUrl = process.env.SQS_PAYROLL_QUEUE_URL;
  const CHUNK_SIZE = 50;
  try {
    let chunksDispatched = 0;

    // Slice the massive array into small bites of 50 IDs
    for (let i = 0; i < employeeIds.length; i += CHUNK_SIZE) {
      const chunk = employeeIds.slice(i, i + CHUNK_SIZE);

      const payload = {
        batchId: batchId.toString(),
        orgId: orgId.toString(),
        year,
        month,
        employeeIds: chunk, // 50 IDs per message
      };

      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(payload),
      });

      await sqsClient.send(command);
      chunksDispatched++;
    }

    console.log(
      `[SQS Producer] Dispatched ${chunksDispatched} chunks for Batch ${batchId}`,
    );
  } catch (error) {
    console.error(`[SQS Producer Error] Failed to dispatch messages:`, error);
    // Note: In a fully bulletproof system, you would update the PayrollBatch status to 'failed' here
  }
};
