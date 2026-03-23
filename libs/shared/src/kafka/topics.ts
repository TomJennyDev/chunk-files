// ============================================
// Kafka Topics
// ============================================
export const KAFKA_TOPICS = {
  // File lifecycle events
  FILE_UPLOADED: "file.uploaded",
  FILE_PROCESSING_STARTED: "file.processing.started",
  FILE_PROCESSING_PROGRESS: "file.processing.progress",
  FILE_PROCESSING_COMPLETED: "file.processing.completed",
  FILE_PROCESSING_FAILED: "file.processing.failed",

  // Search events
  CHUNKS_INDEXED: "chunks.indexed",
  SEARCH_REQUESTED: "search.requested",

  // Notification events
  NOTIFICATION_SEND: "notification.send",

  // Dead Letter Queue
  DLQ: "file.processing.dlq",
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

// ============================================
// Kafka Consumer Groups
// ============================================
export const CONSUMER_GROUPS = {
  UPLOAD_SERVICE: "upload-service-group",
  PROCESSING_SERVICE: "processing-service-group",
  SEARCH_SERVICE: "search-service-group",
  NOTIFICATION_SERVICE: "notification-service-group",
  API_GATEWAY: "api-gateway-group",
} as const;

// ============================================
// Kafka Client IDs
// ============================================
export const KAFKA_CLIENT_IDS = {
  API_GATEWAY: "api-gateway",
  UPLOAD_SERVICE: "upload-service",
  PROCESSING_SERVICE: "processing-service",
  SEARCH_SERVICE: "search-service",
  NOTIFICATION_SERVICE: "notification-service",
} as const;
