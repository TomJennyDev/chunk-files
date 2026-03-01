/**
 * OpenTelemetry Metrics Interceptor for NestJS
 *
 * Records custom application metrics:
 * - HTTP request duration histogram
 * - HTTP request counter
 * - Active request gauge
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap, finalize } from 'rxjs';
import { metrics } from '@opentelemetry/api';
import type { Request, Response } from 'express';

const meter = metrics.getMeter('chunk-files-api');

// Custom application metrics
const httpRequestDuration = meter.createHistogram('http_request_duration_ms', {
  description: 'Duration of HTTP requests in ms',
  unit: 'ms',
});

const httpRequestTotal = meter.createCounter('http_request_total', {
  description: 'Total number of HTTP requests',
});

const activeRequests = meter.createUpDownCounter('http_active_requests', {
  description: 'Number of active HTTP requests',
});

const fileUploadSize = meter.createHistogram('file_upload_size_bytes', {
  description: 'Size of uploaded files in bytes',
  unit: 'bytes',
});

const searchQueryDuration = meter.createHistogram('search_query_duration_ms', {
  description: 'Duration of search queries in ms',
  unit: 'ms',
});

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MetricsInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const startTime = Date.now();

    const method = request.method;
    const route = request.route?.path || request.path;

    // Track active requests
    activeRequests.add(1, { method, route });

    // Track file upload size
    if (request.file) {
      fileUploadSize.record(request.file.size, {
        mimetype: request.file.mimetype,
      });
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const response = httpContext.getResponse<Response>();
          this.recordMetrics(method, route, response.statusCode, startTime);
        },
        error: (error) => {
          const statusCode = error.status || error.statusCode || 500;
          this.recordMetrics(method, route, statusCode, startTime);
        },
      }),
      finalize(() => {
        activeRequests.add(-1, { method, route });
      }),
    );
  }

  private recordMetrics(
    method: string,
    route: string,
    statusCode: number,
    startTime: number,
  ) {
    const duration = Date.now() - startTime;
    const attributes = {
      method,
      route,
      status_code: statusCode.toString(),
    };

    httpRequestDuration.record(duration, attributes);
    httpRequestTotal.add(1, attributes);

    // Track search-specific metrics
    if (route.includes('search')) {
      searchQueryDuration.record(duration, {
        status_code: statusCode.toString(),
      });
    }
  }
}
