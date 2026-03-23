// Domain Entity: File Upload
export class FileUpload {
  constructor(
    public readonly id: string,
    public readonly originalName: string,
    public readonly mimeType: string,
    public readonly size: number,
    public readonly s3Key: string,
    public readonly uploadedAt: Date,
    public status: FileStatus,
    public totalChunks?: number,
    public processedChunks?: number,
    public error?: string,
  ) {}

  markAsProcessing(): void {
    this.status = FileStatus.PROCESSING;
  }

  setTotalChunks(totalChunks: number): void {
    this.totalChunks = totalChunks;
  }

  markAsCompleted(totalChunks: number): void {
    this.status = FileStatus.COMPLETED;
    this.totalChunks = totalChunks;
    this.processedChunks = totalChunks;
  }

  markAsFailed(error: string): void {
    this.status = FileStatus.FAILED;
    this.error = error;
  }

  updateProgress(processedChunks: number): void {
    this.processedChunks = processedChunks;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      originalName: this.originalName,
      mimeType: this.mimeType,
      size: this.size,
      s3Key: this.s3Key,
      uploadedAt: this.uploadedAt.toISOString(),
      status: this.status,
      totalChunks: this.totalChunks,
      processedChunks: this.processedChunks,
      error: this.error,
    };
  }

  static fromJSON(data: Record<string, any>): FileUpload {
    return new FileUpload(
      data.id,
      data.originalName,
      data.mimeType,
      data.size,
      data.s3Key,
      new Date(data.uploadedAt),
      data.status as FileStatus,
      data.totalChunks,
      data.processedChunks,
      data.error,
    );
  }
}

export enum FileStatus {
  UPLOADED = "uploaded",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}
