// Output Port: Queue Port
export interface IQueuePort {
  sendMessage(message: QueueMessage): Promise<string>;
  receiveMessages(maxMessages: number): Promise<QueueMessage[]>;
  deleteMessage(receiptHandle: string): Promise<void>;
  changeMessageVisibility(
    receiptHandle: string,
    visibilityTimeout: number,
  ): Promise<void>;
}

export const IQueuePort = Symbol('IQueuePort');

export interface QueueMessage {
  id?: string;
  body: FileProcessingMessage;
  receiptHandle?: string;
  attributes?: Record<string, any>;
}

export interface FileProcessingMessage {
  fileId: string;
  fileName: string;
  s3Key: string;
  fileSize: number;
  mimeType: string;
  timestamp: string;
}
