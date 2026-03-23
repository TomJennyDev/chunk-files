import { Controller, Logger, Inject } from "@nestjs/common";
import {
  EventPattern,
  Payload,
  Ctx,
  KafkaContext,
  ClientKafka,
} from "@nestjs/microservices";
import {
  KAFKA_TOPICS,
  MICROSERVICE_CLIENTS,
  FileProcessingStartedEvent,
  FileProcessingCompletedEvent,
  FileProcessingFailedEvent,
  FileProcessingProgressEvent,
} from "@chunk-files/shared";
import { S3Service } from "../services/s3.service";
import { ChunkingService } from "../services/chunking.service";
import { ElasticsearchService } from "../services/elasticsearch.service";
import { ProgressService } from "../services/progress.service";

@Controller()
export class ProcessingController {
  private readonly logger = new Logger(ProcessingController.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly chunkingService: ChunkingService,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly progressService: ProgressService,
    @Inject(MICROSERVICE_CLIENTS.UPLOAD_SERVICE)
    private readonly uploadClient: ClientKafka,
    @Inject(MICROSERVICE_CLIENTS.NOTIFICATION_SERVICE)
    private readonly notificationClient: ClientKafka,
  ) {}

  /**
   * Consume file.processing.started events from Kafka
   * 1. Download file from S3
   * 2. Split into chunks
   * 3. Index chunks to Elasticsearch
   * 4. Emit completion/failure events
   */
  @EventPattern(KAFKA_TOPICS.FILE_PROCESSING_STARTED)
  async handleFileProcessing(
    @Payload() message: any,
    @Ctx() context: KafkaContext,
  ) {
    const { fileId, fileName, s3Key, fileSize, mimeType, correlationId } =
      message.value || message;

    const startTime = Date.now();
    this.logger.log(
      `[${correlationId}] Processing started: ${fileName} (${fileId})`,
    );

    try {
      // 1. Download file from S3
      this.logger.log(`[${correlationId}] Downloading from S3: ${s3Key}`);
      const fileBuffer = await this.s3Service.getFile(s3Key);

      // 2. Split into chunks
      const chunks = this.chunkingService.splitIntoChunks(
        fileBuffer,
        fileId,
        fileName,
        fileSize,
        mimeType,
      );
      this.logger.log(`[${correlationId}] Split into ${chunks.length} chunks`);

      // 3. Index chunks to Elasticsearch in batches
      const batchSize = parseInt(process.env.BATCH_SIZE || "100", 10);
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        await this.elasticsearchService.bulkIndexChunks(batch);

        const processed = Math.min(i + batchSize, chunks.length);
        const percentage = Math.round((processed / chunks.length) * 100);

        // Emit progress event
        const progressEvent: FileProcessingProgressEvent = {
          fileId,
          totalChunks: chunks.length,
          processedChunks: processed,
          percentage,
          correlationId,
        };
        this.notificationClient.emit(KAFKA_TOPICS.FILE_PROCESSING_PROGRESS, {
          key: fileId,
          value: progressEvent,
        });

        this.logger.log(
          `[${correlationId}] Indexed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} (${percentage}%)`,
        );
      }

      // 4. Emit completion event
      const processingTime = Date.now() - startTime;
      const completedEvent: FileProcessingCompletedEvent = {
        fileId,
        fileName,
        totalChunks: chunks.length,
        processingTimeMs: processingTime,
        completedAt: new Date().toISOString(),
        correlationId,
      };

      this.uploadClient.emit(KAFKA_TOPICS.FILE_PROCESSING_COMPLETED, {
        key: fileId,
        value: completedEvent,
      });

      this.notificationClient.emit(KAFKA_TOPICS.FILE_PROCESSING_COMPLETED, {
        key: fileId,
        value: completedEvent,
      });

      this.logger.log(
        `[${correlationId}] Processing completed: ${fileId} (${chunks.length} chunks in ${processingTime}ms)`,
      );
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Processing failed for ${fileId}: ${error.message}`,
        error.stack,
      );

      // Emit failure event
      const failedEvent: FileProcessingFailedEvent = {
        fileId,
        fileName,
        error: error.message,
        failedAt: new Date().toISOString(),
        correlationId,
      };

      this.uploadClient.emit(KAFKA_TOPICS.FILE_PROCESSING_FAILED, {
        key: fileId,
        value: failedEvent,
      });

      this.notificationClient.emit(KAFKA_TOPICS.FILE_PROCESSING_FAILED, {
        key: fileId,
        value: failedEvent,
      });

      // Send to DLQ
      this.uploadClient.emit(KAFKA_TOPICS.DLQ, {
        key: fileId,
        value: {
          originalTopic: KAFKA_TOPICS.FILE_PROCESSING_STARTED,
          error: error.message,
          payload: { fileId, fileName, s3Key },
          failedAt: new Date().toISOString(),
        },
      });
    }
  }
}
