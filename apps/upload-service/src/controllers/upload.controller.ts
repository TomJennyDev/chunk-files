import { Controller, Logger, Inject } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload, Ctx, KafkaContext, ClientKafka } from '@nestjs/microservices';
import {
  KAFKA_TOPICS,
  MESSAGE_PATTERNS,
  MICROSERVICE_CLIENTS,
  FileUploadedEvent,
  REDIS_PREFIXES,
} from '@chunk-files/shared';
import { S3Service } from '../services/s3.service';
import { RedisFileRepository } from '../repositories/redis-file.repository';
import { FileUpload, FileStatus } from '@chunk-files/shared';

@Controller()
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly fileRepository: RedisFileRepository,
    @Inject(MICROSERVICE_CLIENTS.PROCESSING_SERVICE)
    private readonly processingClient: ClientKafka,
  ) {}

  /**
   * Handle file upload event from API Gateway
   * 1. Upload file buffer to S3
   * 2. Save metadata to Redis
   * 3. Emit file.processing.started event
   */
  @EventPattern(KAFKA_TOPICS.FILE_UPLOADED)
  async handleFileUploaded(@Payload() message: any, @Ctx() context: KafkaContext) {
    const { fileId, fileName, s3Key, fileSize, mimeType, uploadedAt, correlationId, fileBuffer } = message.value || message;

    this.logger.log(`[${correlationId}] Processing upload: ${fileName} (${fileId})`);

    try {
      // 1. Decode and upload to S3
      const buffer = Buffer.from(fileBuffer, 'base64');
      await this.s3Service.uploadFile(buffer, s3Key, mimeType, fileName);
      this.logger.log(`[${correlationId}] File uploaded to S3: ${s3Key}`);

      // 2. Save metadata to Redis
      const fileUpload = new FileUpload(
        fileId,
        fileName,
        mimeType,
        fileSize,
        s3Key,
        new Date(uploadedAt),
        FileStatus.UPLOADED,
      );
      await this.fileRepository.save(fileUpload);
      this.logger.log(`[${correlationId}] File metadata saved to Redis: ${fileId}`);

      // 3. Emit processing event to Kafka
      this.processingClient.emit(KAFKA_TOPICS.FILE_PROCESSING_STARTED, {
        key: fileId,
        value: {
          fileId,
          fileName,
          s3Key,
          fileSize,
          mimeType,
          correlationId,
          startedAt: new Date().toISOString(),
        },
      });

      this.logger.log(`[${correlationId}] Processing event emitted for: ${fileId}`);
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Upload handling failed: ${error.message}`,
        error.stack,
      );

      // Save failed status
      const failedFile = new FileUpload(
        fileId, fileName, mimeType, fileSize, s3Key,
        new Date(uploadedAt), FileStatus.FAILED,
      );
      failedFile.markAsFailed(error.message);
      await this.fileRepository.save(failedFile);
    }
  }

  /**
   * Request/Response: Get file status
   */
  @MessagePattern(MESSAGE_PATTERNS.GET_FILE_STATUS)
  async getFileStatus(@Payload() data: { fileId: string }) {
    const file = await this.fileRepository.findById(data.fileId);
    if (!file) {
      return { error: 'File not found', fileId: data.fileId };
    }
    return file.toJSON();
  }

  /**
   * Request/Response: List all files
   */
  @MessagePattern(MESSAGE_PATTERNS.GET_FILE_LIST)
  async getFileList() {
    const files = await this.fileRepository.findAll();
    return files.map((f) => f.toJSON());
  }

  /**
   * Listen for processing completion events to update file status
   */
  @EventPattern(KAFKA_TOPICS.FILE_PROCESSING_COMPLETED)
  async handleProcessingCompleted(@Payload() message: any) {
    const { fileId, totalChunks, correlationId } = message.value || message;
    this.logger.log(`[${correlationId}] Processing completed for: ${fileId}`);

    const file = await this.fileRepository.findById(fileId);
    if (file) {
      file.markAsCompleted(totalChunks);
      await this.fileRepository.update(file);
    }
  }

  /**
   * Listen for processing failure events to update file status
   */
  @EventPattern(KAFKA_TOPICS.FILE_PROCESSING_FAILED)
  async handleProcessingFailed(@Payload() message: any) {
    const { fileId, error: errorMsg, correlationId } = message.value || message;
    this.logger.error(`[${correlationId}] Processing failed for: ${fileId} - ${errorMsg}`);

    const file = await this.fileRepository.findById(fileId);
    if (file) {
      file.markAsFailed(errorMsg);
      await this.fileRepository.update(file);
    }
  }
}
