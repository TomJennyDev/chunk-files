/**
 * OpenTelemetry Browser Tracing
 *
 * Traces all fetch() calls from the browser to the backend API.
 * Propagates trace context (W3C traceparent header) so backend
 * traces are correlated with frontend traces in Grafana/Tempo.
 */
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const OTEL_ENDPOINT =
  import.meta.env.VITE_OTEL_ENDPOINT || 'http://localhost:4318';

const provider = new WebTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'chunk-files-web',
    [ATTR_SERVICE_VERSION]: '1.0.0',
    'deployment.environment': import.meta.env.MODE || 'development',
  }),
  spanProcessors: [
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: `${OTEL_ENDPOINT}/v1/traces`,
      }),
    ),
  ],
});

provider.register({
  contextManager: new ZoneContextManager(),
});

registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation({
      // Propagate trace context to these backends
      propagateTraceHeaderCorsUrls: [
        /localhost:3000/,   // NestJS API
        /localhost:4318/,   // OTel Collector
      ],
      // Add custom attributes to fetch spans
      applyCustomAttributesOnSpan: (span, request) => {
        if (request instanceof Request) {
          span.setAttribute('http.request.url', request.url);
        }
      },
      // Ignore tracing for OTel Collector itself to avoid infinite loops
      ignoreUrls: [/\/v1\/traces/],
    }),
    new XMLHttpRequestInstrumentation({
      propagateTraceHeaderCorsUrls: [
        /localhost:3000/,
      ],
    }),
  ],
});

console.log('📡 Browser tracing initialized → ' + OTEL_ENDPOINT);

export { provider };
