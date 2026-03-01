# API Service

Backend service: `apps/file-processor`.

## Responsibilities

- Receive file uploads
- Store original files in S3 (LocalStack in local mode)
- Enqueue processing jobs to SQS
- Expose search and status APIs
- Provide file download endpoint

## Main Endpoints

- `POST /files/upload`
- `GET /files/:fileId/status`
- `GET /files/:fileId/download`
- `GET /files/search`
- `GET /health`

Swagger UI:

- `http://localhost:3000/api/docs`

## Runtime Dependencies

- AWS S3 + SQS via SDK v3
- Elasticsearch/OpenSearch client
- NestJS + Multer

## Key Internal Components

- Controller: `src/presentation/controllers/file.controller.ts`
- Upload use case: `src/application/use-cases/upload-file.use-case.ts`
- Search use case: `src/application/use-cases/search-files.use-case.ts`
- Storage adapter: `src/infrastructure/adapters/s3.adapter.ts`
- Queue adapter: `src/infrastructure/adapters/sqs.adapter.ts`
- Search adapter: `src/infrastructure/adapters/elasticsearch.adapter.ts`

## Important Notes

- Current status repository is in-memory (`InMemoryFileRepository`), so status is lost after API restart.
- Search pagination currently uses page input from frontend; keep page indexing consistent across clients.

## Local Development

```bash
pnpm --filter @chunk-files/api dev
```

## Environment Variables (Core)

- `APP_PORT`
- `AWS_ENDPOINT`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_BUCKET_NAME`
- `SQS_QUEUE_URL`
- `ELASTICSEARCH_NODE`
- `ELASTICSEARCH_INDEX`
- `CHUNK_SIZE`
- `CHUNK_OVERLAP`
- `MAX_FILE_SIZE`