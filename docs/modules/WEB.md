# Web Frontend

Frontend app: `apps/web`.

## Responsibilities

- Upload files to API
- Poll processing status
- Search indexed file content
- Navigate and preview content in markdown/iframe flows

## App Routes (Current)

- `/` home
- `/upload`
- `/search`
- `/iframe`
- `/markdown`

## API Integration

Frontend API client is in `src/services/api.ts`.

Default API base URL:

- `VITE_API_URL` or fallback `http://localhost:3000`

## Main UI Components

- Upload: `src/components/FileUpload/FileUpload.tsx`
- Search: `src/components/FileSearch/FileSearch.tsx`
- Markdown content: `src/components/MarkdownContent/*`
- Renderer: `src/components/MarkdownRenderer/MarkdownRenderer.tsx`

## Local Development

```bash
pnpm --filter @chunk-files/web dev
```

## Build and Test

```bash
pnpm --filter @chunk-files/web build
pnpm --filter @chunk-files/web test
```

## Notes

- UI currently maps status values in uppercase while backend returns lowercase; align status enum handling to avoid inconsistent badge colors/loading state.