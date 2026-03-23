import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 10,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Exponential backoff retry with jitter.
 * Used to wait for infrastructure (Kafka, Redis, ES) to become available.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  label = 'operation',
): Promise<T> {
  const logger = new Logger('RetryWithBackoff');
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === opts.maxRetries) {
        logger.error(
          `[${label}] Failed after ${opts.maxRetries} attempts: ${error.message}`,
        );
        throw error;
      }

      // Exponential backoff with jitter
      const baseDelay =
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1);
      const jitter = Math.random() * opts.initialDelayMs;
      const delay = Math.min(baseDelay + jitter, opts.maxDelayMs);

      logger.warn(
        `[${label}] Attempt ${attempt}/${opts.maxRetries} failed: ${error.message}. Retrying in ${Math.round(delay)}ms...`,
      );

      opts.onRetry?.(attempt, error as Error);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(`[${label}] Unreachable`);
}

/**
 * Wait for a condition to become true with exponential backoff.
 */
export async function waitForCondition(
  check: () => Promise<boolean>,
  options: Partial<RetryOptions> = {},
  label = 'condition',
): Promise<void> {
  await retryWithBackoff(
    async () => {
      const result = await check();
      if (!result) {
        throw new Error(`${label} not ready`);
      }
    },
    options,
    label,
  );
}
