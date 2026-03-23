// ============================================
// Kafka Events - File Upload Events
// ============================================

export interface FileUploadedEvent {
  fileId: string;
  fileName: string;
  s3Key: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  correlationId: string;
}

export interface FileProcessingStartedEvent {
  fileId: string;
  fileName: string;
  s3Key: string;
  fileSize: number;
  mimeType: string;
  startedAt: string;
  correlationId: string;
}

export interface FileProcessingProgressEvent {
  fileId: string;
  totalChunks: number;
  processedChunks: number;
  percentage: number;
  correlationId: string;
}

export interface FileProcessingCompletedEvent {
  fileId: string;
  fileName: string;
  totalChunks: number;
  processingTimeMs: number;
  completedAt: string;
  correlationId: string;
}

export interface FileProcessingFailedEvent {
  fileId: string;
  fileName: string;
  error: string;
  failedAt: string;
  correlationId: string;
  retryCount?: number;
}

export interface ChunksIndexedEvent {
  fileId: string;
  chunksCount: number;
  indexName: string;
  indexedAt: string;
  correlationId: string;
}

// ============================================
// Notification Events
// ============================================

export interface NotificationEvent {
  type: "file.status" | "file.progress" | "file.error";
  fileId: string;
  payload: Record<string, any>;
  timestamp: string;
  correlationId: string;
}

// ============================================
// Event Envelope (wraps all events with metadata)
// ============================================

export interface EventEnvelope<T = any> {
  eventId: string;
  eventType: string;
  timestamp: string;
  source: string;
  correlationId: string;
  data: T;
  metadata?: Record<string, any>;
}
