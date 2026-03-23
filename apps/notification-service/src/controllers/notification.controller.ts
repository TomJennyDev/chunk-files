import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
  KAFKA_TOPICS,
  FileProcessingProgressEvent,
  FileProcessingCompletedEvent,
  FileProcessingFailedEvent,
} from '@chunk-files/shared';
import { NotificationGateway } from '../gateways/notification.gateway';
import { RedisNotificationService } from '../services/redis-notification.service';

@Controller()
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    private readonly notificationGateway: NotificationGateway,
    private readonly redisNotification: RedisNotificationService,
  ) {}

  /**
   * Listen for processing progress events
   */
  @EventPattern(KAFKA_TOPICS.FILE_PROCESSING_PROGRESS)
  async handleProgress(@Payload() message: any) {
    const data: FileProcessingProgressEvent = message.value || message;

    this.logger.log(
      `[${data.correlationId}] Progress: ${data.fileId} - ${data.percentage}% (${data.processedChunks}/${data.totalChunks})`,
    );

    // Broadcast via WebSocket
    this.notificationGateway.sendNotification('file:progress', {
      fileId: data.fileId,
      totalChunks: data.totalChunks,
      processedChunks: data.processedChunks,
      percentage: data.percentage,
    });

    // Publish to Redis Pub/Sub
    await this.redisNotification.publishEvent('file:progress', data);
  }

  /**
   * Listen for processing completed events
   */
  @EventPattern(KAFKA_TOPICS.FILE_PROCESSING_COMPLETED)
  async handleCompleted(@Payload() message: any) {
    const data: FileProcessingCompletedEvent = message.value || message;

    this.logger.log(
      `[${data.correlationId}] Completed: ${data.fileId} (${data.totalChunks} chunks in ${data.processingTimeMs}ms)`,
    );

    this.notificationGateway.sendNotification('file:completed', {
      fileId: data.fileId,
      fileName: data.fileName,
      totalChunks: data.totalChunks,
      processingTimeMs: data.processingTimeMs,
    });

    await this.redisNotification.publishEvent('file:completed', data);
  }

  /**
   * Listen for processing failed events
   */
  @EventPattern(KAFKA_TOPICS.FILE_PROCESSING_FAILED)
  async handleFailed(@Payload() message: any) {
    const data: FileProcessingFailedEvent = message.value || message;

    this.logger.error(
      `[${data.correlationId}] Failed: ${data.fileId} - ${data.error}`,
    );

    this.notificationGateway.sendNotification('file:failed', {
      fileId: data.fileId,
      fileName: data.fileName,
      error: data.error,
    });

    await this.redisNotification.publishEvent('file:failed', data);
  }
}
