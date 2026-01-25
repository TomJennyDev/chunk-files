import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
} from '@aws-sdk/client-sqs';
import {
  IQueuePort,
  QueueMessage,
  FileProcessingMessage,
} from '@domain/ports/queue.port';

@Injectable()
export class SQSAdapter implements IQueuePort {
  private readonly logger = new Logger(SQSAdapter.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string;
  private readonly pollingWaitTime: number;
  private readonly visibilityTimeout: number;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('AWS_ENDPOINT');
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');

    this.sqsClient = new SQSClient({
      endpoint,
      region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', 'test'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', 'test'),
      },
    });

    this.queueUrl = this.configService.get<string>('SQS_QUEUE_URL', 'http://localhost:4566/000000000000/file-processing-queue');
    this.pollingWaitTime = this.configService.get<number>('SQS_POLLING_WAIT_TIME', 20);
    this.visibilityTimeout = this.configService.get<number>('SQS_VISIBILITY_TIMEOUT', 300);

    this.logger.log(`SQS Adapter initialized with queue: ${this.queueUrl}`);
  }

  async sendMessage(message: QueueMessage): Promise<string> {
    try {
      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message.body),
        MessageAttributes: message.attributes
          ? Object.entries(message.attributes).reduce((acc, [key, value]) => {
              acc[key] = {
                DataType: 'String',
                StringValue: String(value),
              };
              return acc;
            }, {})
          : undefined,
      });

      const response = await this.sqsClient.send(command);
      this.logger.log(`Message sent to SQS: ${response.MessageId}`);

      return response.MessageId || '';
    } catch (error) {
      this.logger.error(`Failed to send message to SQS: ${error.message}`, error.stack);
      throw new Error(`SQS send failed: ${error.message}`);
    }
  }

  async receiveMessages(maxMessages: number): Promise<QueueMessage[]> {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: Math.min(maxMessages, 10),
        WaitTimeSeconds: this.pollingWaitTime,
        VisibilityTimeout: this.visibilityTimeout,
        MessageAttributeNames: ['All'],
      });

      const response = await this.sqsClient.send(command);
      const messages = response.Messages || [];

      this.logger.log(`Received ${messages.length} messages from SQS`);

      return messages.map((msg) => ({
        id: msg.MessageId,
        body: JSON.parse(msg.Body || '{}') as FileProcessingMessage,
        receiptHandle: msg.ReceiptHandle,
        attributes: msg.MessageAttributes,
      }));
    } catch (error) {
      this.logger.error(`Failed to receive messages from SQS: ${error.message}`, error.stack);
      throw new Error(`SQS receive failed: ${error.message}`);
    }
  }

  async deleteMessage(receiptHandle: string): Promise<void> {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      });

      await this.sqsClient.send(command);
      this.logger.log(`Message deleted from SQS`);
    } catch (error) {
      this.logger.error(`Failed to delete message from SQS: ${error.message}`, error.stack);
      throw new Error(`SQS delete failed: ${error.message}`);
    }
  }

  async changeMessageVisibility(
    receiptHandle: string,
    visibilityTimeout: number,
  ): Promise<void> {
    try {
      const command = new ChangeMessageVisibilityCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
        VisibilityTimeout: visibilityTimeout,
      });

      await this.sqsClient.send(command);
      this.logger.log(`Message visibility changed: ${visibilityTimeout}s`);
    } catch (error) {
      this.logger.error(
        `Failed to change message visibility: ${error.message}`,
        error.stack,
      );
      throw new Error(`SQS visibility change failed: ${error.message}`);
    }
  }
}
