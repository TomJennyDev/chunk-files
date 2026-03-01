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
}

export enum FileStatus {
  UPLOADED = "uploaded",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}
