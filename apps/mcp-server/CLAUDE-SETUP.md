# 🎯 Claude Desktop Setup Guide

Hướng dẫn chi tiết để tích hợp MCP Server với Claude Desktop.

## 📋 Prerequisites

1. ✅ **Claude Desktop** installed ([Download here](https://claude.ai/download))
2. ✅ **Node.js 20+** installed
3. ✅ **Backend API** running on `http://localhost:3000`
4. ✅ **MCP Server** built successfully

## 🔧 Step-by-Step Setup

### Step 1: Build MCP Server

```bash
cd mcp-server
npm install
npm run build
```

Verify build success:
```bash
ls dist/
# Should see: index.js, tools/, resources/
```

### Step 2: Locate Configuration File

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

Full path example:
```
C:\Users\YourUsername\AppData\Roaming\Claude\claude_desktop_config.json
```

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

**Cách tìm nhanh:**

Windows (PowerShell):
```powershell
cd $env:APPDATA\Claude
notepad claude_desktop_config.json
```

macOS/Linux:
```bash
cd ~/Library/Application\ Support/Claude
open claude_desktop_config.json
```

### Step 3: Add MCP Server Configuration

**Nếu file chưa tồn tại**, tạo file mới với nội dung:

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

**Nếu file đã có**, thêm vào `mcpServers`:

```json
{
  "mcpServers": {
    "existing-server": {
      "command": "...",
      "args": ["..."]
    },
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

**⚠️ Quan trọng:**
- Sử dụng **absolute path** (đường dẫn tuyệt đối)
- Thay đổi path cho phù hợp với hệ thống của bạn
- Windows: Dùng forward slashes `/` hoặc double backslashes `\\`

**Path Examples:**

Windows:
```json
"D:/devops/terraform/terraform-eks/localstack/mcp-server/dist/index.js"
```

hoặc:

```json
"C:\\Users\\Tom\\Projects\\localstack\\mcp-server\\dist\\index.js"
```

macOS/Linux:
```json
"/Users/tom/devops/localstack/mcp-server/dist/index.js"
```

### Step 4: Restart Claude Desktop

1. **Hoàn toàn thoát** Claude Desktop (không chỉ minimize)
   - Windows: Right-click taskbar icon → Exit
   - macOS: Cmd+Q
   - Linux: Close from app menu

2. **Khởi động lại** Claude Desktop

3. **Kiểm tra connection** trong Claude chat:
   ```
   Do you see the chunk-files MCP server?
   ```

## ✅ Verification

### Test 1: Check Server Connection

Trong Claude Desktop, hỏi:

```
What tools do you have access to from the chunk-files MCP server?
```

**Expected response:**
```
I have access to these tools from chunk-files:
- upload_file - Upload files for processing
- search_files - Search through documents
- get_file_status - Check processing status
- analyze_document - AI-powered document analysis
```

### Test 2: List Resources

```
Can you show me the available file resources?
```

**Expected response:**
```
Available files:
- file://abc123... - document.pdf (completed, 2.4 MB)
- file://def456... - research.docx (processing, 1.8 MB)
...
```

### Test 3: Upload a File

```
Please upload this text file for me.
[Attach a small .txt file]
```

**Expected response:**
```
✅ File "test.txt" uploaded successfully!
📋 File ID: [uuid]
⏳ Status: PROCESSING
```

## 🐛 Troubleshooting

### ❌ Server not appearing in Claude

**Solution 1: Check Config Path**
```bash
# Windows
dir %APPDATA%\Claude\claude_desktop_config.json

# macOS/Linux
ls -la ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Solution 2: Validate JSON**
```bash
# Use online JSON validator or:
python -m json.tool claude_desktop_config.json
```

**Solution 3: Check Node.js Path**
```bash
# Windows
where node

# macOS/Linux
which node
```

Add full Node.js path if needed:
```json
{
  "mcpServers": {
    "chunk-files": {
      "command": "C:/Program Files/nodejs/node.exe",
      "args": ["D:/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

### ❌ Connection Errors

**Check logs:**

Windows:
```
%APPDATA%\Claude\logs\
```

macOS:
```
~/Library/Logs/Claude/
```

**Common issues:**

1. **Backend not running**
   ```bash
   curl http://localhost:3000/health
   ```
   Start backend: `npm run start:dev`

2. **Port conflict**
   Change port in `.env`:
   ```env
   API_BASE_URL=http://localhost:3001
   ```

3. **Firewall blocking**
   Allow Node.js through firewall

### ❌ Tools not working

**Verify server runs standalone:**
```bash
cd mcp-server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

Should return tool definitions.

**Check API accessibility:**
```bash
curl http://localhost:3000/files
```

### ❌ File upload fails

1. **Check file size** (max 500MB)
2. **Verify MIME type** in validator
3. **Check API logs** for errors

## 🎨 Advanced Configuration

### Use Environment-Specific API

Development:
```json
{
  "mcpServers": {
    "chunk-files-dev": {
      "command": "node",
      "args": ["D:/path/mcp-server/dist/index.js"],
      "env": {
        "API_BASE_URL": "http://localhost:3000"
      }
    },
    "chunk-files-prod": {
      "command": "node",
      "args": ["D:/path/mcp-server/dist/index.js"],
      "env": {
        "API_BASE_URL": "https://api.production.com"
      }
    }
  }
}
```

### Debug Mode

Enable verbose logging:
```json
{
  "mcpServers": {
    "chunk-files": {
      "command": "node",
      "args": ["D:/path/mcp-server/dist/index.js"],
      "env": {
        "API_BASE_URL": "http://localhost:3000",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### Multiple Instances

```json
{
  "mcpServers": {
    "chunk-files-personal": {
      "command": "node",
      "args": ["D:/personal/mcp-server/dist/index.js"],
      "env": {
        "API_BASE_URL": "http://localhost:3000"
      }
    },
    "chunk-files-work": {
      "command": "node",
      "args": ["D:/work/mcp-server/dist/index.js"],
      "env": {
        "API_BASE_URL": "http://work-api:8080"
      }
    }
  }
}
```

## 📚 Usage Examples

### Example 1: Research Workflow

```
User: I'm working on a research paper about quantum computing. 
Can you help me organize my sources?

Claude: Of course! Let's start by uploading your research papers.
You can send me the files and I'll process them.

User: [Uploads 3 PDF files]

Claude: I'll upload these files for processing.
[Uses upload_file for each]

✅ All 3 files uploaded:
1. quantum-algorithms.pdf - Processing
2. error-correction.pdf - Processing  
3. topological-qubits.pdf - Processing

They should be ready to search in about a minute.

---

[After 1 minute]

User: Can you find all mentions of "surface codes"?

Claude: Let me search for that.
[Uses search_files]

Found 8 relevant passages across your papers:

From quantum-algorithms.pdf:
"...surface codes provide a practical approach to quantum error 
correction with only nearest-neighbor interactions..."

From error-correction.pdf:
"...the threshold error rate for surface codes is approximately 1%, 
making them suitable for near-term quantum computers..."
```

### Example 2: Document Analysis

```
User: Can you summarize the key points from quantum-algorithms.pdf?

Claude: I'll analyze that document for you.
[Uses analyze_document with type="summary"]

📝 Summary of quantum-algorithms.pdf:

This paper surveys quantum algorithms for optimization problems. 
Main topics covered:

1. **Quantum Approximate Optimization Algorithm (QAOA)**
   - Variational approach for combinatorial optimization
   - Performance on MaxCut and graph coloring problems

2. **Quantum Annealing**
   - Comparison with classical simulated annealing
   - Hardware implementations on D-Wave systems

3. **Grover's Algorithm**
   - Quadratic speedup for unstructured search
   - Applications to database queries

Would you like me to extract specific topics or analyze sentiment?
```

### Example 3: Multi-file Search

```
User: Compare what all three papers say about error rates

Claude: I'll search across all files for error rate discussions.
[Uses search_files with query="error rates comparison"]

Here's what each paper says:

**quantum-algorithms.pdf** (Relevance: 0.92)
"...current NISQ devices have error rates around 0.1-1%, limiting 
circuit depth to ~100 gates..."

**error-correction.pdf** (Relevance: 0.88)
"...with surface codes, we can tolerate physical error rates up to 
1% while maintaining logical error rates below 10^-15..."

**topological-qubits.pdf** (Relevance: 0.85)
"...topological protection could potentially reduce error rates 
to below 10^-6 even without active error correction..."

Key insight: There's a progression from NISQ (~1% raw) → 
Surface codes (corrected to 10^-15) → Topological (~10^-6 protected).
```

## 🎓 Tips & Best Practices

### 1. File Naming
Use descriptive filenames:
- ✅ `ml-transformer-attention-2024.pdf`
- ❌ `document1.pdf`

### 2. Batch Uploads
Upload related files together for better context:
```
Upload these 5 papers about transformers for my literature review
[Attach files]
```

### 3. Structured Queries
Be specific in search queries:
```
Find passages discussing self-attention mechanisms in transformer 
architectures, specifically regarding computational complexity
```

### 4. Progressive Analysis
1. Upload → 2. Search → 3. Analyze → 4. Synthesize

### 5. Resource Management
Check file status before analyzing:
```
What's the status of file [id]?
```

## 📞 Support

### Get Help

1. **Check Documentation**: [README.md](README.md)
2. **Review Logs**: Claude Desktop logs folder
3. **Test API**: `curl http://localhost:3000/health`
4. **Rebuild**: `npm run rebuild`

### Report Issues

Include:
- Claude Desktop version
- Node.js version (`node --version`)
- Error messages from logs
- Configuration file (remove sensitive data)

---

**Ready to use? Start chatting with Claude!** 🚀

```
Hi Claude! Can you show me what file processing tools you have access to?
```
