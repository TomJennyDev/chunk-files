import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { IStoragePort } from '@domain/ports/storage.port';
import { ISearchPort } from '@domain/ports/search.port';
import { IFileRepository } from '@domain/ports/file-repository.port';
import { FileChunk } from '@domain/entities/file-chunk.entity';
import { FileStatus } from '@domain/entities/file-upload.entity';

export interface ProcessFileCommand {
  fileId: string;
  fileName: string;
  s3Key: string;
  fileSize: number;
  mimeType: string;
}

@Injectable()
export class ProcessFileUseCase {
  private readonly logger = new Logger(ProcessFileUseCase.name);
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(
    @Inject(IStoragePort)
    private readonly storagePort: IStoragePort,
    @Inject(ISearchPort)
    private readonly searchPort: ISearchPort,
    @Inject(IFileRepository)
    private readonly fileRepository: IFileRepository,
    private readonly configService: ConfigService,
  ) {
    this.chunkSize = this.configService.get<number>('CHUNK_SIZE', 5242880); // 5MB default
    this.chunkOverlap = this.configService.get<number>('CHUNK_OVERLAP', 100);
  }

  async execute(command: ProcessFileCommand): Promise<void> {
    const { fileId, fileName, s3Key, fileSize, mimeType } = command;

    this.logger.log(`Processing file: ${fileName} (${fileId})`);

    try {
      // 1. Update file status to processing
      const fileUpload = await this.fileRepository.findById(fileId);
      if (!fileUpload) {
        throw new Error(`File not found: ${fileId}`);
      }
      fileUpload.markAsProcessing();
      await this.fileRepository.update(fileUpload);

      // 2. Download file from S3
      this.logger.log(`Downloading file from S3: ${s3Key}`);
      const fileBuffer = await this.storagePort.getFile(s3Key);

      // 3. Split file into chunks
      const chunks = this.splitIntoChunks(
        fileBuffer,
        fileId,
        fileName,
        fileSize,
        mimeType,
      );
      this.logger.log(`File split into ${chunks.length} chunks`);

      // 4. Index chunks to Elasticsearch in batches
      const batchSize = 100;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        await this.searchPort.bulkIndexChunks(batch);
        
        // Update progress
        fileUpload.updateProgress(Math.min(i + batchSize, chunks.length));
        await this.fileRepository.update(fileUpload);
        
        this.logger.log(
          `Indexed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`,
        );
      }

      // 5. Mark file as completed
      fileUpload.markAsCompleted(chunks.length);
      await this.fileRepository.update(fileUpload);

      this.logger.log(`File processing completed: ${fileId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process file ${fileId}: ${error.message}`,
        error.stack,
      );

      // Mark file as failed
      const fileUpload = await this.fileRepository.findById(fileId);
      if (fileUpload) {
        fileUpload.markAsFailed(error.message);
        await this.fileRepository.update(fileUpload);
      }

      throw error;
    }
  }

  private splitIntoChunks(
    buffer: Buffer,
    fileId: string,
    fileName: string,
    fileSize: number,
    mimeType: string,
  ): FileChunk[] {
    const chunks: FileChunk[] = [];
    const totalChunks = Math.ceil(buffer.length / this.chunkSize);

    for (let i = 0; i < buffer.length; i += this.chunkSize) {
      const start = Math.max(0, i - this.chunkOverlap);
      const end = Math.min(buffer.length, i + this.chunkSize);
      const chunkBuffer = buffer.slice(start, end);
      const content = chunkBuffer.toString('utf-8');

      const chunk = new FileChunk(
        uuidv4(),
        fileId,
        Math.floor(i / this.chunkSize),
        content,
        start,
        end,
        {
          fileName,
          mimeType,
          totalChunks,
          fileSize,
          encoding: 'utf-8',
        },
        new Date(),
      );

      chunks.push(chunk);
    }

    return chunks;
  }
}
