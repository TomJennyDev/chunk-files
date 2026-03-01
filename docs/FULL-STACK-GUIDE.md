# 🚀 Hướng dẫn chạy Full Stack - Từ Docker Compose đến MCP Server

Hướng dẫn chi tiết từng bước để chạy toàn bộ hệ thống File Processor từ đầu.

## 📋 Yêu cầu hệ thống

| Yêu cầu | Phiên bản |
|----------|-----------|
| Docker Desktop | 4.x+ |
| Node.js | 20.x+ |
| pnpm | 8.x+ |
| AWS CLI | 2.x (optional, để test) |
| RAM trống | ≥ 4GB (Elasticsearch cần ~1GB) |

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────┐
│                   Docker Compose                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  LocalStack   │  │Elasticsearch │  │  Kibana   │  │
│  │  :4566        │  │  :9200       │  │  :5601    │  │
│  │  S3/SQS/IAM  │  │  file-chunks │  │  UI       │  │
│  └──────────────┘  └──────────────┘  └───────────┘  │
└─────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌──────────────────────────────────────────────────────┐
│     NestJS Backend API (:3000)                        │
│     POST /files/upload → S3 + SQS                    │
│     GET  /files/:fileId/status                        │
│     GET  /files/search?text=...                       │
│     GET  /health                                      │
│     Swagger: /api/docs                                │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│     MCP Server (stdio)                                │
│     Tools: upload_file, search_files,                 │
│            get_file_status, analyze_document          │
│     → Proxy tới NestJS API                            │
└──────────────────────────────────────────────────────┘
```

---

## Bước 1: Khởi động Docker Compose

### 1.1 Start tất cả services

```bash
cd localstack
docker compose up -d
```

Docker Compose sẽ khởi động 3 containers:
- **LocalStack** (`localhost:4566`) — Giả lập S3, SQS, IAM, Lambda
- **Elasticsearch** (`localhost:9200`) — Search engine, index `file-chunks`
- **Kibana** (`localhost:5601`) — UI dashboard cho Elasticsearch

### 1.2 Kiểm tra containers đã healthy

```bash
docker compose ps
```

Kết quả mong đợi:
```
NAME                        STATUS
elasticsearch-local         Up (healthy)
file-processor-localstack   Up (healthy)
kibana-local                Up (health: starting → healthy)
```

### 1.3 Kiểm tra LocalStack services

```bash
curl -s http://localhost:4566/_localstack/health | python -m json.tool
```

Các services cần **available/running**: `s3`, `sqs`, `iam`, `lambda`, `logs`, `kms`, `opensearch`

### 1.4 Kiểm tra Elasticsearch

```bash
curl -s http://localhost:9200/
```

Kết quả mong đợi:
```json
{
  "cluster_name": "file-processor-cluster",
  "version": { "number": "8.11.0" },
  "tagline": "You Know, for Search"
}
```

### 1.5 Kiểm tra AWS resources (S3 + SQS)

```bash
# S3 bucket
aws --endpoint-url=http://localhost:4566 s3 ls
# → file-uploads

# SQS queue
aws --endpoint-url=http://localhost:4566 sqs list-queues --region us-east-1
# → file-processing-queue
```

> **Lưu ý**: Script `init-aws.sh` tự động tạo S3 bucket và SQS queue khi LocalStack khởi động. Nếu resources chưa có (lần đầu chạy), chạy thủ công:
> ```bash
> aws --endpoint-url=http://localhost:4566 s3 mb s3://file-uploads
> aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name file-processing-queue --region us-east-1
> ```

---

## Bước 2: Khởi động NestJS Backend API

### 2.1 Cài đặt dependencies

```bash
cd file-processor
pnpm install
```

### 2.2 Kiểm tra file `.env`

File `.env` cần có các biến sau:

```bash
NODE_ENV=development
APP_PORT=3000

# AWS (LocalStack)
AWS_REGION=us-east-1
AWS_ENDPOINT=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# S3
S3_BUCKET_NAME=file-uploads
S3_FORCE_PATH_STYLE=true

# SQS
SQS_QUEUE_URL=http://localhost:4566/000000000000/file-processing-queue

# Elasticsearch (port 9200, KHÔNG phải 4566)
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_INDEX=file-chunks
```

> ⚠️ **Quan trọng**: `ELASTICSEARCH_NODE` phải trỏ tới port **9200** (Elasticsearch container), KHÔNG phải port 4566 (LocalStack).

### 2.3 Chạy backend

```bash
pnpm run start:dev
```

Kết quả mong đợi:
```
[Nest] LOG [NestFactory] Starting Nest application...
[Nest] LOG [S3Adapter] S3 Adapter initialized with bucket: file-uploads
[Nest] LOG [SQSAdapter] SQS Adapter initialized with queue: http://localhost:4566/...
[Nest] LOG [ElasticsearchAdapter] Initializing Elasticsearch client with node: http://localhost:9200
[Nest] LOG 🚀 Application is running on: http://localhost:3000
[Nest] LOG 📚 Swagger documentation: http://localhost:3000/api/docs
```

### 2.4 Kiểm tra backend health

```bash
curl -s http://localhost:3000/health
```

```json
{
  "statusCode": 200,
  "message": "Service is healthy",
  "timestamp": "2026-02-18T09:42:28.653Z"
}
```

### 2.5 Xem Swagger docs

Mở trình duyệt: http://localhost:3000/api/docs

API endpoints:
| Method | Endpoint | Mô tả |
|--------|----------|--------|
| `POST` | `/files/upload` | Upload file (`multipart/form-data`) |
| `GET` | `/files/:fileId/status` | Kiểm tra trạng thái xử lý file |
| `GET` | `/files/search?text=...` | Tìm kiếm trong file đã index |
| `GET` | `/health` | Health check |

---

## Bước 3: Test Upload File qua API

### 3.1 Upload file markdown

```bash
# Tạo file test
cat > /tmp/test-document.md << 'EOF'
# Test Document

This is a test markdown document for the file processor.

## Section 1: Introduction

The file processor system handles uploading, chunking, and indexing of documents
using S3 for storage, SQS for queuing, and Elasticsearch for search.

## Section 2: Architecture

- **S3**: Object storage for uploaded files
- **SQS**: Message queue for async processing
- **Elasticsearch**: Full-text search engine
- **Lambda**: Serverless processing functions
EOF

# Upload
curl -s -X POST http://localhost:3000/files/upload \
  -F "file=@/tmp/test-document.md" | python -m json.tool
```

Kết quả:
```json
{
  "statusCode": 201,
  "message": "File uploaded successfully",
  "data": {
    "fileId": "8f242e79-6e3e-41e5-af24-19db694c1f6c",
    "fileName": "test-document.md",
    "fileSize": 450,
    "s3Key": "uploads/8f242e79-.../test-document.md",
    "status": "uploaded",
    "uploadedAt": "2026-02-18T09:43:31.190Z"
  }
}
```

### 3.2 Kiểm tra trạng thái file

```bash
curl -s http://localhost:3000/files/YOUR_FILE_ID/status
```

```json
{
  "statusCode": 200,
  "data": {
    "fileId": "...",
    "fileName": "test-document.md",
    "status": "uploaded",
    "progress": 0
  }
}
```

> **Lưu ý**: Status sẽ là `uploaded` vì Lambda chưa được deploy để xử lý. Xem [Bước 5](#bước-5-optional-deploy-lambda-function) để deploy Lambda.

### 3.3 Kiểm tra file đã lưu trên S3

```bash
aws --endpoint-url=http://localhost:4566 s3 ls s3://file-uploads/ --recursive
```

### 3.4 Tìm kiếm (search)

```bash
curl -s "http://localhost:3000/files/search?text=architecture"
```

```json
{
  "statusCode": 200,
  "data": {
    "total": 0,
    "results": [],
    "took": 1
  }
}
```

> Search trả về 0 results cho đến khi Lambda xử lý file và index các chunks vào Elasticsearch.

---

## Bước 4: Build & Test MCP Server

### 4.1 Cài đặt và build

```bash
cd mcp-server
pnpm install
pnpm run build
```

Kiểm tra build thành công:
```bash
ls dist/
# index.js  tools/  resources/
```

### 4.2 Test MCP Server initialization

```bash
# Test initialize handshake
node -e "
const { spawn } = require('child_process');
const child = spawn('node', ['dist/index.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
let output = '';
child.stdout.on('data', d => output += d.toString());
child.stderr.on('data', () => {});

const init = JSON.stringify({
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: {
    protocolVersion: '0.1.0',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0' }
  }
});

child.stdin.write(init + '\n');
setTimeout(() => {
  child.stdin.end();
  setTimeout(() => {
    console.log(output);
    process.exit(0);
  }, 1000);
}, 1000);
"
```

Kết quả mong đợi:
```json
{
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": {}, "resources": {} },
    "serverInfo": { "name": "chunk-files-mcp", "version": "1.0.0" }
  },
  "jsonrpc": "2.0",
  "id": 1
}
```

### 4.3 Test tools/list

```bash
node -e "
const { spawn } = require('child_process');
const c = spawn('node', ['dist/index.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
let o = '';
c.stdout.on('data', d => o += d.toString());
c.stderr.on('data', () => {});

const init = JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'0.1.0',capabilities:{},clientInfo:{name:'test',version:'1.0'}}});
const list = JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list'});

c.stdin.write(init + '\n');
setTimeout(() => {
  c.stdin.write(list + '\n');
  setTimeout(() => {
    c.stdin.end();
    setTimeout(() => {
      o.split('\n').filter(l => l.trim()).forEach(l => {
        try { const j = JSON.parse(l); if (j.id === 2) console.log(JSON.stringify(j, null, 2)); } catch(e) {}
      });
      process.exit(0);
    }, 1000);
  }, 1000);
}, 1000);
"
```

Kết quả: 4 tools được đăng ký:
- `upload_file` — Upload file lên S3
- `search_files` — Tìm kiếm trong nội dung file
- `get_file_status` — Kiểm tra trạng thái file
- `analyze_document` — Phân tích tài liệu bằng AI

### 4.4 Test MCP tool call (search_files)

```bash
node -e "
const { spawn } = require('child_process');
const c = spawn('node', ['dist/index.js'], { stdio: ['pipe', 'pipe', 'pipe'] });
let o = '';
c.stdout.on('data', d => o += d.toString());
c.stderr.on('data', () => {});

const msgs = [
  JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'0.1.0',capabilities:{},clientInfo:{name:'test',version:'1.0'}}}),
  JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'search_files',arguments:{query:'test',limit:5}}})
];

c.stdin.write(msgs[0] + '\n');
setTimeout(() => {
  c.stdin.write(msgs[1] + '\n');
  setTimeout(() => {
    c.stdin.end();
    setTimeout(() => {
      o.split('\n').filter(l => l.trim()).forEach(l => {
        try { const j = JSON.parse(l); if (j.id === 2) console.log(JSON.stringify(j, null, 2)); } catch(e) {}
      });
      process.exit(0);
    }, 2000);
  }, 2000);
}, 1000);
"
```

Kết quả mong đợi:
```json
{
  "result": {
    "content": [{
      "type": "text",
      "text": "{ \"success\": true, \"query\": \"test\", \"total\": 0, ... }"
    }]
  }
}
```

---

## Bước 5: Cấu hình MCP Server cho IDE

### 5.1 VS Code + GitHub Copilot

Thêm vào `.vscode/settings.json`:

```json
{
  "mcp": {
    "servers": {
      "chunk-files": {
        "command": "node",
        "args": ["${workspaceFolder}/mcp-server/dist/index.js"],
        "env": {
          "API_BASE_URL": "http://localhost:3000"
        }
      }
    }
  }
}
```

Sau đó trong Copilot Chat, gõ:
```
@chunk-files search for "elasticsearch architecture"
```

### 5.2 Claude Desktop

Sửa file config (`%APPDATA%\Claude\claude_desktop_config.json` trên Windows):

```json
{
  "mcpServers": {
    "chunk-files": {
      "command": "node",
      "args": ["D:/devops/terraform/terraform-eks/localstack/mcp-server/dist/index.js"],
      "env": {
        "API_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

> **Lưu ý**: Dùng đường dẫn tuyệt đối cho Claude Desktop.

### 5.3 Cursor IDE

Thêm vào `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "chunk-files": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js"],
      "env": {
        "API_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

---

## Bước 6 (Optional): Deploy Lambda Function

Lambda xử lý file từ SQS → chunk → index vào Elasticsearch. Deploy lên LocalStack:

```bash
cd file-processor-lambda

# Install dependencies
npm install

# Deploy to LocalStack
bash deploy.sh
```

Sau khi Lambda deployed, flow đầy đủ:
```
Upload → S3 + SQS → Lambda trigger → Chunk file → Index vào Elasticsearch → Search
```

---

## 🔧 Troubleshooting

### Docker containers không start được

```bash
# Kiểm tra logs
docker compose logs localstack
docker compose logs elasticsearch

# Restart
docker compose down && docker compose up -d
```

### Elasticsearch connection refused

```bash
# Kiểm tra Elasticsearch có chạy không
curl http://localhost:9200/

# Kiểm tra .env file
cat file-processor/.env | grep ELASTICSEARCH
# Phải là: ELASTICSEARCH_NODE=http://localhost:9200
```

### NestJS không connect được S3/SQS

```bash
# Kiểm tra LocalStack
curl http://localhost:4566/_localstack/health

# Tạo resources thủ công nếu cần
aws --endpoint-url=http://localhost:4566 s3 mb s3://file-uploads
aws --endpoint-url=http://localhost:4566 sqs create-queue --queue-name file-processing-queue --region us-east-1
```

### MCP Server không respond

```bash
# Rebuild
cd mcp-server
pnpm run rebuild

# Kiểm tra backend API đang chạy
curl http://localhost:3000/health

# Test trực tiếp
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"0.1.0","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node dist/index.js
```

### Port đã bị chiếm

```bash
# Kiểm tra port
netstat -ano | findstr :3000
netstat -ano | findstr :4566
netstat -ano | findstr :9200

# Kill process (Windows)
taskkill /PID <PID> /F
```

---

## 📊 Kiểm tra toàn bộ hệ thống

Script kiểm tra nhanh tất cả services:

```bash
echo "=== System Health Check ==="

echo -n "LocalStack: "
curl -s http://localhost:4566/_localstack/health | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.services.s3==='running'?'✅ OK':'❌ FAIL')})" 2>/dev/null || echo "❌ DOWN"

echo -n "Elasticsearch: "
curl -s http://localhost:9200/ | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.version?'✅ OK v'+j.version.number:'❌ FAIL')})" 2>/dev/null || echo "❌ DOWN"

echo -n "Backend API: "
curl -s http://localhost:3000/health | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.statusCode===200?'✅ OK':'❌ FAIL')})" 2>/dev/null || echo "❌ DOWN"

echo -n "Kibana: "
curl -s http://localhost:5601/api/status | node -e "process.stdin.on('data',d=>{console.log(d.toString().includes('available')?'✅ OK':'⏳ Starting')})" 2>/dev/null || echo "❌ DOWN"

echo -n "S3 Bucket: "
aws --endpoint-url=http://localhost:4566 s3 ls 2>/dev/null | grep -q file-uploads && echo "✅ OK" || echo "❌ MISSING"

echo -n "SQS Queue: "
aws --endpoint-url=http://localhost:4566 sqs list-queues --region us-east-1 2>/dev/null | grep -q file-processing && echo "✅ OK" || echo "❌ MISSING"

echo -n "ES Index: "
curl -s http://localhost:9200/file-chunks 2>/dev/null | grep -q file-chunks && echo "✅ OK" || echo "❌ MISSING"

echo "==========================="
```

---

## 🛑 Shutdown

```bash
# Dừng NestJS backend (Ctrl+C trong terminal đang chạy)

# Dừng Docker containers
cd localstack
docker compose down

# Dừng và xóa data (reset hoàn toàn)
docker compose down -v
```

---

## 📁 Quick Reference - Ports & URLs

| Service | URL | Mô tả |
|---------|-----|--------|
| LocalStack | http://localhost:4566 | AWS services emulator |
| Elasticsearch | http://localhost:9200 | Search engine |
| Kibana | http://localhost:5601 | ES dashboard |
| Backend API | http://localhost:3000 | NestJS REST API |
| Swagger Docs | http://localhost:3000/api/docs | API documentation |

| MCP Tool | Chức năng |
|----------|-----------|
| `upload_file` | Upload file lên S3 và queue xử lý |
| `search_files` | Tìm kiếm nội dung file đã index |
| `get_file_status` | Kiểm tra trạng thái xử lý |
| `analyze_document` | Phân tích tài liệu (summary, topics, sentiment) |
