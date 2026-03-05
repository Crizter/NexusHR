import 'dotenv/config' ; 
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

// ── SQS client — singleton, reused across all API requests ───────────────────
export const sqsClient = new SQSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
