/**
 * Winston Logger Configuration
 *
 * Sends logs to:
 * 1. Console (pretty-printed for development)
 * 2. OpenTelemetry Collector → Loki (via OTel Winston transport)
 *
 * All logs are automatically correlated with traces via trace_id/span_id.
 */
import * as winston from 'winston';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';
import { WinstonModule } from 'nest-winston';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Pretty console format for development
const devFormat = printf(({ level, message, timestamp, context, trace, ...meta }) => {
  const ctx = context ? `[${context}]` : '';
  const traceInfo = meta.trace_id ? ` traceId=${meta.trace_id}` : '';
  const metaStr = Object.keys(meta).length > 0 && !meta.trace_id
    ? ` ${JSON.stringify(meta)}`
    : '';
  return `${timestamp} ${level} ${ctx} ${message}${traceInfo}${metaStr}`;
});

// JSON format for production / log aggregation
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Create Winston logger instance with OTel transport
 */
export function createWinstonLogger() {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: {
      service: 'chunk-files-api',
    },
    transports: [
      // Console output
      new winston.transports.Console({
        format: isDev
          ? combine(
              colorize({ all: true }),
              timestamp({ format: 'HH:mm:ss.SSS' }),
              devFormat,
            )
          : prodFormat,
      }),

      // OpenTelemetry → OTel Collector → Loki
      new OpenTelemetryTransportV3({
        level: 'info',
      }),
    ],
  });
}

/**
 * Create NestJS-compatible logger using Winston
 */
export function createNestWinstonLogger() {
  return WinstonModule.createLogger({
    instance: createWinstonLogger(),
  });
}
