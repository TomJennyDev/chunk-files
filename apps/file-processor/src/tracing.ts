/**
 * OpenTelemetry Tracing Bootstrap
 *
 * MUST be imported BEFORE any other module in main.ts
 * Initializes auto-instrumentation for HTTP, Express, NestJS, and AWS SDK
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

const OTEL_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: "chunk-files-api",
  [ATTR_SERVICE_VERSION]: "1.0.0",
  "deployment.environment": process.env.NODE_ENV || "development",
});

// Trace exporter → OTel Collector → Tempo
const traceExporter = new OTLPTraceExporter({
  url: `${OTEL_ENDPOINT}/v1/traces`,
});

// Metric exporter → OTel Collector → Prometheus
const metricExporter = new OTLPMetricExporter({
  url: `${OTEL_ENDPOINT}/v1/metrics`,
});

// Log exporter → OTel Collector → Loki
const logExporter = new OTLPLogExporter({
  url: `${OTEL_ENDPOINT}/v1/logs`,
});

const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 15000,
  }),
  logRecordProcessor: new BatchLogRecordProcessor(logExporter),
  instrumentations: [
    getNodeAutoInstrumentations({
      // HTTP - trace all incoming/outgoing requests
      "@opentelemetry/instrumentation-http": {
        enabled: true,
        ignoreIncomingRequestHook: (req) => {
          // Ignore health check endpoints
          return req.url === "/health" || req.url === "/metrics";
        },
      },
      // Express - trace route handlers
      "@opentelemetry/instrumentation-express": {
        enabled: true,
      },
      // NestJS - trace controllers, guards, pipes, interceptors
      "@opentelemetry/instrumentation-nestjs-core": {
        enabled: true,
      },
      // AWS SDK - trace S3, SQS, Lambda calls
      "@opentelemetry/instrumentation-aws-sdk": {
        enabled: true,
        suppressInternalInstrumentation: true,
      },
      // Elasticsearch - trace search queries
      "@opentelemetry/instrumentation-undici": {
        enabled: true,
      },
      // Winston logs → auto-inject trace_id/span_id for correlation
      "@opentelemetry/instrumentation-winston": {
        enabled: true,
      },
      // Disable noisy instrumentations
      "@opentelemetry/instrumentation-fs": {
        enabled: false,
      },
      "@opentelemetry/instrumentation-dns": {
        enabled: false,
      },
      "@opentelemetry/instrumentation-net": {
        enabled: false,
      },
    }),
  ],
});

sdk.start();
console.log("📡 OpenTelemetry tracing initialized → " + OTEL_ENDPOINT);

// Graceful shutdown
const shutdown = async () => {
  try {
    await sdk.shutdown();
    console.log("📡 OpenTelemetry SDK shut down gracefully");
  } catch (err) {
    console.error("Error shutting down OpenTelemetry SDK", err);
  }
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { sdk };
