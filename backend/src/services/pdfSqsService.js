import { sqsClient } from "./sqsService.js";
import { SendMessageBatchCommand } from "@aws-sdk/client-sqs";


export const dispatchPdfGeneration = async (payslipIds) => {
  // return
  if (!payslipIds || payslipIds.length === 0) {
    return;
  }
  const queueUrl = process.env.SQS_HR_PDF_URL;
  const CHUNK_SIZE = 10;
  let chunksDispatched = 0;

  try {
    for (let i = 0; i < payslipIds.length; i += CHUNK_SIZE) {
      const chunk = payslipIds.slice(i, i + CHUNK_SIZE);
      const entries = chunk.map((id, index) => ({
        Id: `msg-${index}`,
        MessageBody: JSON.stringify({ paySlipId: id }),
      }));

      const command = new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: entries,
      });
      await sqsClient.send(command);
      chunksDispatched++;
    }
    console.log(
      `[SQS PDF Producer] Dispatched ${chunksDispatched} chunks (Total: ${payslipIds.length} payslips)`,
    );
  } catch (error) {
    console.error(`[SQS Producer Error] Failed to dispatch messages:`, error);
  }
};
