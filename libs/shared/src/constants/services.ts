// ============================================
// Microservice Names & Ports
// ============================================

export const SERVICES = {
  API_GATEWAY: {
    name: "api-gateway",
    port: 3000,
  },
  UPLOAD_SERVICE: {
    name: "upload-service",
    port: 3001,
  },
  PROCESSING_SERVICE: {
    name: "processing-service",
    port: 3002,
  },
  SEARCH_SERVICE: {
    name: "search-service",
    port: 3003,
  },
  NOTIFICATION_SERVICE: {
    name: "notification-service",
    port: 3004,
  },
} as const;

// ============================================
// NestJS Microservice Client Tokens
// ============================================

export const MICROSERVICE_CLIENTS = {
  UPLOAD_SERVICE: "UPLOAD_SERVICE",
  PROCESSING_SERVICE: "PROCESSING_SERVICE",
  SEARCH_SERVICE: "SEARCH_SERVICE",
  NOTIFICATION_SERVICE: "NOTIFICATION_SERVICE",
} as const;

// ============================================
// Message Patterns (for Request/Response via Kafka)
// ============================================

export const MESSAGE_PATTERNS = {
  // Upload
  UPLOAD_FILE: "upload.file",
  GET_FILE_STATUS: "upload.file.status",
  GET_FILE_LIST: "upload.file.list",
  DOWNLOAD_FILE: "upload.file.download",

  // Search
  SEARCH_FILES: "search.files",
  SEARCH_BY_FILE_ID: "search.files.byId",

  // Processing
  PROCESS_FILE: "processing.file.process",

  // Notification
  SUBSCRIBE_NOTIFICATIONS: "notification.subscribe",
} as const;
