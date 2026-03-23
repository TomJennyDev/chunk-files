// ============================================
// Redis Key Patterns & Constants
// ============================================

export const REDIS_PREFIXES = {
  FILE_METADATA: "file:metadata:",
  FILE_STATUS: "file:status:",
  FILE_PROGRESS: "file:progress:",
  SEARCH_CACHE: "search:cache:",
  RATE_LIMIT: "rate:limit:",
  NOTIFICATION_CHANNEL: "notifications:",
  LOCK: "lock:",
} as const;

export const REDIS_TTL = {
  FILE_METADATA: 3600, // 1 hour
  FILE_STATUS: 300, // 5 minutes
  SEARCH_CACHE: 600, // 10 minutes
  RATE_LIMIT_WINDOW: 60, // 1 minute
  LOCK_TTL: 30, // 30 seconds
} as const;

export const REDIS_CHANNELS = {
  FILE_EVENTS: "file-events",
  PROCESSING_EVENTS: "processing-events",
  NOTIFICATIONS: "notifications",
} as const;

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}
