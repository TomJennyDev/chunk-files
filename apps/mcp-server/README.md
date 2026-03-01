# 🤖 Chunk Files MCP Server

Model Context Protocol (MCP) server for the Chunk Files application. Provides AI-powered file processing, search, and analysis capabilities through a conversational interface.

## 🌟 Features

### 🔧 Tools
- **`upload_file`** - Upload files (PDF, DOCX, TXT, MD, JSON, XML, CSV) up to 500MB
- **`search_files`** - Natural language search through file contents
- **`get_file_status`** - Check processing status and metadata
- **`analyze_document`** - AI-powered analysis (summary, topics, sentiment, entities)

### 📚 Resources
- **`file://{fileId}`** - Access file metadata and content

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd mcp-server
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
API_BASE_URL=http://localhost:3000
```

### 3. Build & Run

```bash
# Build TypeScript
npm run build

# Start server
npm start

# Or run in development mode with auto-reload
npm run dev
```

## 🎯 Usage with Claude Desktop

### Configuration

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### Add MCP Server

```json
{
  "mcpServers": {
    "chunk-files": {
      "command": "node",
      "args": [
        "D:/devops/terraform/terraform-eks/localstack/mcp-server/dist/index.js"
      ],
      "env": {
        "API_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

**Important:** Use absolute paths and adjust for your system.

### Restart Claude Desktop

After saving the configuration, restart Claude Desktop to load the MCP server.

## 💬 Example Conversations

### Upload a File

```
User: Can you upload this research paper?
[Attaches ML-Research.pdf]

Claude: I'll upload that file for you.
[Uses upload_file tool]

✅ File "ML-Research.pdf" uploaded successfully!
📋 File ID: abc123-def456-789
⏳ Status: PROCESSING
🔍 The file is being chunked and indexed. This usually takes 30-60 seconds.
```

### Search Files

```
User: Find all documents discussing transformer architectures

Claude: I'll search for documents about transformer architectures.
[Uses search_files tool]

🔍 Found 5 results:

1. **attention-is-all-you-need.pdf** (Score: 0.95)
   "...The Transformer architecture relies entirely on self-attention 
   mechanisms to compute representations..."

2. **deep-learning-guide.docx** (Score: 0.87)
   "...Transformer models have revolutionized NLP by processing entire 
   sequences in parallel..."

3. **bert-gpt-comparison.md** (Score: 0.82)
   "...Both BERT and GPT use transformer blocks but differ in their 
   training objectives..."
```

### Check File Status

```
User: What's the status of file abc123-def456-789?

Claude: Let me check the file status.
[Uses get_file_status tool]

📊 File Status:
- **Name:** ML-Research.pdf
- **Status:** COMPLETED ✅
- **Size:** 2.4 MB
- **Chunks:** 12/12 processed (100%)
- **Uploaded:** 2026-02-18 10:30:45
```

### Analyze Document

```
User: Can you summarize the ML research paper?

Claude: I'll analyze and summarize the document.
[Uses analyze_document tool with type="summary"]

📝 Document Summary:

This paper introduces a novel approach to few-shot learning using 
meta-learning techniques. The authors demonstrate that their method 
achieves state-of-the-art results on benchmark datasets with significantly 
fewer training examples. Key contributions include:

1. A new meta-learning algorithm that adapts quickly to new tasks
2. Theoretical analysis of convergence properties
3. Empirical validation on CIFAR-100 and Mini-ImageNet

The results show 15-20% improvement over previous methods.
```

## 🛠️ Development

### Project Structure

```
mcp-server/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── tools/                # Tool implementations
│   │   ├── upload.ts         # File upload
│   │   ├── search.ts         # Search files
│   │   ├── status.ts         # Get file status
│   │   └── analyze.ts        # Document analysis
│   └── resources/            # Resource handlers
│       └── files.ts          # File resources
├── dist/                     # Compiled JavaScript
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### Development Mode

```bash
# Watch mode with auto-reload
npm run dev

# Build only
npm run build

# Clean build artifacts
npm run clean

# Rebuild from scratch
npm run rebuild
```

### Debugging

```bash
# Run with Node.js inspector
npm run inspect

# Then attach debugger in VS Code or Chrome DevTools
```

## 📝 API Reference

### Tools

#### `upload_file`

Upload a file to the backend for processing.

**Parameters:**
- `filename` (string, required) - File name with extension
- `content` (string, required) - Base64 encoded file content
- `mimeType` (string, required) - MIME type of the file

**Returns:**
```json
{
  "success": true,
  "fileId": "abc123-def456",
  "fileName": "document.pdf",
  "fileSize": 1048576,
  "status": "uploaded",
  "s3Key": "uploads/abc123-def456/document.pdf",
  "uploadedAt": "2026-02-18T10:30:45.000Z"
}
```

#### `search_files`

Search through file contents using natural language.

**Parameters:**
- `query` (string, required) - Search query
- `limit` (number, optional) - Max results (default: 10, max: 100)
- `offset` (number, optional) - Pagination offset (default: 0)

**Returns:**
```json
{
  "success": true,
  "query": "machine learning",
  "total": 25,
  "returned": 10,
  "results": [
    {
      "rank": 1,
      "fileId": "abc123",
      "fileName": "ml-guide.pdf",
      "chunkIndex": 5,
      "content": "...",
      "relevanceScore": 0.95
    }
  ]
}
```

#### `get_file_status`

Get processing status of a file.

**Parameters:**
- `fileId` (string, required) - File UUID

**Returns:**
```json
{
  "success": true,
  "fileId": "abc123",
  "fileName": "document.pdf",
  "status": "completed",
  "totalChunks": 10,
  "processedChunks": 10,
  "progress": "100%"
}
```

#### `analyze_document`

Perform AI-powered analysis.

**Parameters:**
- `fileId` (string, required) - File UUID
- `analysisType` (enum, required) - One of: `summary`, `topics`, `sentiment`, `entities`

**Returns:**
```json
{
  "success": true,
  "fileId": "abc123",
  "analysisType": "summary",
  "summary": "Document summary text...",
  "message": "📝 Document summarized successfully"
}
```

### Resources

#### `file://{fileId}`

Access file metadata and content.

**Example:**
```
file://abc123-def456-789
```

**Returns:**
```json
{
  "metadata": {
    "fileId": "abc123",
    "fileName": "document.pdf",
    "fileSize": 1048576,
    "status": "completed",
    "totalChunks": 10
  },
  "chunks": [...],
  "fullText": "Combined text of all chunks..."
}
```

## 🔍 Troubleshooting

### Server won't start

1. Check Node.js version: `node --version` (must be >= 20.0.0)
2. Rebuild: `npm run rebuild`
3. Check logs in stderr

### Claude Desktop doesn't see the server

1. Verify config file path
2. Use absolute paths in configuration
3. Check server builds successfully: `npm run build`
4. Restart Claude Desktop completely

### API connection errors

1. Verify backend is running: `curl http://localhost:3000/health`
2. Check `API_BASE_URL` in config
3. Review network/firewall settings

### File upload fails

1. Check file size (max 500MB)
2. Verify MIME type is supported
3. Ensure content is properly base64 encoded

## 📚 Resources

- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Claude Desktop Download](https://claude.ai/download)
- [Chunk Files Backend](../file-processor/)

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - See [LICENSE](../LICENSE) file for details.

## 👥 Author

**TomJennyDev**

---

**Built with ❤️ using Model Context Protocol**
