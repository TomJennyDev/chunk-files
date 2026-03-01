# MCP Server

MCP service: `apps/mcp-server`.

## Purpose

Expose Chunk Files capabilities to MCP clients (for example Claude Desktop) through tools and resources.

## Tools

- `upload_file`
- `search_files`
- `get_file_status`
- `analyze_document`

## Resource

- `file://{fileId}`

## Integration Requirements

- Backend API must be running (default `http://localhost:3000`)
- `API_BASE_URL` configured in `.env`

## Local Development

```bash
pnpm --filter @chunk-files/mcp-server dev
```

## Build and Run

```bash
pnpm --filter @chunk-files/mcp-server build
pnpm --filter @chunk-files/mcp-server start
```

## Key Files

- Entry point: `apps/mcp-server/src/index.ts`
- Tools: `apps/mcp-server/src/tools/*`
- Resources: `apps/mcp-server/src/resources/files.ts`

## Common Use Cases

- Conversational upload and search
- AI-assisted document analysis
- Status checks from chat workflows