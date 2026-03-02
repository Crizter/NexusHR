import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

// ── SQS client — singleton, reused across all API requests ───────────────────
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// publishAnalyticsEvent
//
// Fire-and-forget producer — enqueues an analytics recalculation job.
// Never throws — a failed enqueue must never crash the main API response.
//
// @param {string}      orgId      MongoDB ObjectId string of the organisation
// @param {string}      eventType  'LEAVE_APPROVED' | 'EMPLOYEE_HIRED' | 'EMPLOYEE_TERMINATED'
// @param {string|null} yearMonth  "YYYY-MM" — required for LEAVE_APPROVED, null otherwise
// ─────────────────────────────────────────────────────────────────────────────
export const publishAnalyticsEvent = async (orgId, eventType, yearMonth = null) => {
  const payload = {
    orgId,
    eventType,
    yearMonth,
    timestamp: new Date().toISOString(),
  };

  const command = new SendMessageCommand({
    QueueUrl:    process.env.SQS_ANALYTICS_QUEUE_URL,
    MessageBody: JSON.stringify(payload),

    // MessageGroupId would go here for FIFO queues
    // MessageDeduplicationId would go here for FIFO queues
  });

  try {
    const result = await sqsClient.send(command);
    console.log(
      `[SQS Producer]  Event published | type=${eventType} orgId=${orgId} yearMonth=${yearMonth ?? 'N/A'} MessageId=${result.MessageId}`
    );
  } catch (err) {
    // Intentionally swallowed — analytics are eventually consistent.
    // The API response is NOT blocked by a failed enqueue.
    console.error(
      `[SQS Producer]  Failed to publish event | type=${eventType} orgId=${orgId} | ${err.message}`
    );
  }
};