import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { FileUpload, FileStatus } from '@domain/entities/file-upload.entity';
import { IStoragePort } from '@domain/ports/storage.port';
import { IQueuePort, FileProcessingMessage } from '@domain/ports/queue.port';
import { IFileRepository } from '@domain/ports/file-repository.port';

export interface UploadFileCommand {
  file: Express.Multer.File;
}

export interface UploadFileResult {
  fileId: string;
  fileName: string;
  fileSize: number;
  s3Key: string;
  status: string;
  uploadedAt: Date;
}

@Injectable()
export class UploadFileUseCase {
  private readonly logger = new Logger(UploadFileUseCase.name);

  constructor(
    @Inject(IStoragePort)
    private readonly storagePort: IStoragePort,
    @Inject(IQueuePort)
    private readonly queuePort: IQueuePort,
    @Inject(IFileRepository)
    private readonly fileRepository: IFileRepository,
  ) {}

  async execute(command: UploadFileCommand): Promise<UploadFileResult> {
    const { file } = command;
    const fileId = uuidv4();
    const s3Key = `uploads/${fileId}/${file.originalname}`;

    this.logger.log(
      `Uploading file: ${file.originalname} (${file.size} bytes)`,
    );

    try {
      // 1. Upload file to S3
      await this.storagePort.uploadFile(file, s3Key);
      this.logger.log(`File uploaded to S3: ${s3Key}`);

      // 2. Create file upload entity
      const fileUpload = new FileUpload(
        fileId,
        file.originalname,
        file.mimetype,
        file.size,
        s3Key,
        new Date(),
        FileStatus.UPLOADED,
      );

      // 3. Save to repository
      await this.fileRepository.save(fileUpload);
      this.logger.log(`File metadata saved: ${fileId}`);

      // 4. Send processing message to queue
      const message: FileProcessingMessage = {
        fileId,
        fileName: file.originalname,
        s3Key,
        fileSize: file.size,
        mimeType: file.mimetype,
        timestamp: new Date().toISOString(),
      };

      await this.queuePort.sendMessage({ body: message });
      this.logger.log(`Processing message sent to queue for file: ${fileId}`);

      return {
        fileId,
        fileName: file.originalname,
        fileSize: file.size,
        s3Key,
        status: FileStatus.UPLOADED,
        uploadedAt: fileUpload.uploadedAt,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
      throw error;
    }
  }
}
