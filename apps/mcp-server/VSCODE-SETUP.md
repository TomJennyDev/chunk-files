# 🔌 VS Code & GitHub Copilot Integration Guide

Hướng dẫn tích hợp MCP Server với VS Code và GitHub Copilot Chat.

## 📋 Prerequisites

1. ✅ **VS Code** (version 1.85+)
2. ✅ **GitHub Copilot** extension
3. ✅ **GitHub Copilot Chat** extension
4. ✅ GitHub Copilot subscription (active)
5. ✅ Node.js 20+

## 🎯 Installation Steps

### Step 1: Install Required Extensions

Mở VS Code và cài đặt các extensions:

1. **GitHub Copilot** (`github.copilot`)
2. **GitHub Copilot Chat** (`github.copilot-chat`)

Hoặc cài qua command line:
```bash
code --install-extension github.copilot
code --install-extension github.copilot-chat
```

### Step 2: Enable Extensions

1. Sign in to GitHub Copilot
2. Verify subscription: `Ctrl+Shift+P` → "GitHub Copilot: Check Status"
3. Ensure Copilot Chat is enabled

### Step 3: Configure Workspace

File `.vscode/settings.json` đã được tạo với cấu hình:

```json
{
  "mcp.servers": {
    "chunk-files": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp-server/dist/index.js"],
      "env": {
        "API_BASE_URL": "http://localhost:3000"
      }
    }
  },
  "github.copilot.chat.mcp.enabled": true
}
```

### Step 4: Build MCP Server

```bash
cd mcp-server
npm install
npm run build
```

### Step 5: Restart VS Code

Hoàn toàn tắt và mở lại VS Code để load configuration.

## 🚀 Usage in VS Code

### Method 1: GitHub Copilot Chat

#### Open Copilot Chat
- **Shortcut:** `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Shift+I` (macOS)
- **Menu:** View → Copilot Chat
- **Command Palette:** `Ctrl+Shift+P` → "GitHub Copilot: Open Chat"

#### Use MCP Tools

**Example 1: Upload File**

```
@chunk-files upload this file
[Select file in explorer or paste path]
```

**Example 2: Search Files**

```
@chunk-files search for documents about machine learning
```

**Example 3: Check Status**

```
@chunk-files what's the status of file abc123-def456?
```

**Example 4: Analyze Document**

```
@chunk-files analyze file xyz789 and give me a summary
```

### Method 2: Inline Chat

1. Select text in editor
2. Press `Ctrl+K` (Windows/Linux) or `Cmd+K` (macOS)
3. Type command with `@chunk-files` prefix

```
@chunk-files search for this concept in uploaded files
```

### Method 3: Quick Chat

1. Press `Ctrl+Shift+L` (Windows/Linux) or `Cmd+Shift+L` (macOS)
2. Type command

```
@chunk-files help me find documents about transformers
```

## 🎨 Advanced Features

### 1. Workspace Commands

Press `F1` or `Ctrl+Shift+P` to access:

```
> Tasks: Run Task
  → Start Full Stack       (LocalStack + API + MCP)
  → Build MCP Server
  → Test MCP Connection
  → Watch MCP Server
```

### 2. Debug MCP Server

Press `F5` or use Debug panel:

- **Debug MCP Server** - Debug server with breakpoints
- **Debug NestJS API** - Debug backend API
- **Full Stack Debug** - Debug both together

### 3. Integrated Tasks

Các tasks đã được cấu hình trong `.vscode/tasks.json`:

```bash
# Build MCP Server
Ctrl+Shift+B

# Start full stack
Tasks: Run Task → Start Full Stack

# Test MCP connection
Tasks: Run Task → Test MCP Connection
```

## 📝 Examples & Workflows

### Workflow 1: Research Assistant

```
# In Copilot Chat
@chunk-files I'm researching quantum computing. Here are 3 papers.

[Upload papers via file explorer]

@chunk-files upload quantum-algorithms.pdf
@chunk-files upload error-correction.pdf  
@chunk-files upload topological-qubits.pdf

# Wait for processing
@chunk-files check status of all files

# Search across papers
@chunk-files find all mentions of "surface codes" in my papers

# Analyze
@chunk-files analyze quantum-algorithms.pdf and extract key topics
```

### Workflow 2: Code Documentation

```
# Upload documentation
@chunk-files upload this API documentation
[Attach api-docs.md]

# Search during coding
@chunk-files how do I authenticate API requests?

@chunk-files show me examples of error handling in the docs
```

### Workflow 3: Learning & Notes

```
# Upload lecture notes
@chunk-files upload these lecture slides
[Attach ML-Lecture-01.pdf]

# Study with Copilot
@chunk-files summarize the key concepts from ML-Lecture-01

@chunk-files what does the lecture say about backpropagation?

@chunk-files compare gradient descent methods mentioned in the lecture
```

## 🎯 Tips & Best Practices

### 1. Use @mentions

Always prefix with `@chunk-files` to invoke MCP tools:

✅ `@chunk-files search for transformers`
❌ `search for transformers` (won't use MCP)

### 2. Be Specific

Include details in queries:

✅ `@chunk-files search ML papers for attention mechanism complexity analysis`
❌ `@chunk-files search attention`

### 3. Check File Status

Before analyzing, verify processing is complete:

```
@chunk-files status abc123
# Wait until status = "completed"
@chunk-files analyze abc123 summary
```

### 4. Batch Operations

Upload multiple files together:

```
@chunk-files upload all PDF files in the research folder
```

### 5. Context in Editor

Select relevant code/text before asking:

```
[Select function code]
@chunk-files find similar implementations in my documentation
```

## 🔧 Configuration Options

### User Settings (Global)

`File → Preferences → Settings` or `Ctrl+,`

```json
{
  "github.copilot.chat.mcp.enabled": true,
  "github.copilot.enable": {
    "*": true
  }
}
```

### Workspace Settings (Project-specific)

Already configured in `.vscode/settings.json`

### Multiple MCP Servers

Add more servers in settings:

```json
{
  "mcp.servers": {
    "chunk-files": { ... },
    "another-server": {
      "command": "node",
      "args": ["path/to/server.js"]
    }
  }
}
```

## 🐛 Troubleshooting

### Issue: MCP Server Not Found

**Solution:**
```bash
# Verify build
cd mcp-server
npm run build
ls dist/  # Should see index.js

# Test manually
node dist/index.js
```

### Issue: Copilot Can't Connect

**Solution:**

1. Check VS Code output panel:
   - View → Output → Select "GitHub Copilot"

2. Verify configuration:
   ```json
   // .vscode/settings.json
   "mcp.servers": {
     "chunk-files": {
       "command": "node",
       "args": ["${workspaceFolder}/mcp-server/dist/index.js"]
     }
   }
   ```

3. Restart VS Code

### Issue: API Connection Failed

**Solution:**

```bash
# Start backend
cd file-processor
npm run start:dev

# Verify API
curl http://localhost:3000/health
```

### Issue: Tools Not Available

**Solution:**

1. Check Copilot Chat is enabled
2. Type `@` in chat - should see `@chunk-files`
3. If not visible, reload window: `Ctrl+Shift+P` → "Reload Window"

### Issue: Permission Denied

**Windows:**
```powershell
# Run as Administrator or check execution policy
Get-ExecutionPolicy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**macOS/Linux:**
```bash
chmod +x mcp-server/dist/index.js
```

## 🎨 Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|--------------|-------|
| Open Copilot Chat | `Ctrl+Shift+I` | `Cmd+Shift+I` |
| Inline Chat | `Ctrl+K` | `Cmd+K` |
| Quick Chat | `Ctrl+Shift+L` | `Cmd+Shift+L` |
| Toggle Sidebar | `Ctrl+B` | `Cmd+B` |
| Command Palette | `Ctrl+Shift+P` | `Cmd+Shift+P` |
| Start Debugging | `F5` | `F5` |
| Build | `Ctrl+Shift+B` | `Cmd+Shift+B` |

## 📊 Comparison: Claude Desktop vs VS Code Copilot

| Feature | Claude Desktop | VS Code Copilot |
|---------|---------------|-----------------|
| **Interface** | Standalone app | Integrated in editor |
| **Context** | Conversation history | Current workspace + code |
| **Code Editing** | Copy/paste | Direct insertion |
| **File Access** | Via MCP tools | Native + MCP tools |
| **Debugging** | External | Built-in debugger |
| **Extensions** | Limited | Full VS Code ecosystem |
| **Use Case** | General chat + MCP | Code-centric + MCP |

**Best Practice:** Use both!
- **Claude Desktop**: Deep analysis, document review, research
- **VS Code Copilot**: Coding, quick lookups, inline help

## 🚀 Advanced Workflows

### Multi-Server Setup

```json
{
  "mcp.servers": {
    "chunk-files-dev": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp-server/dist/index.js"],
      "env": {
        "API_BASE_URL": "http://localhost:3000"
      }
    },
    "chunk-files-prod": {
      "command": "node", 
      "args": ["${workspaceFolder}/mcp-server/dist/index.js"],
      "env": {
        "API_BASE_URL": "https://api.production.com"
      }
    }
  }
}
```

Usage:
```
@chunk-files-dev search in development files
@chunk-files-prod search in production docs
```

### Custom Keybindings

`File → Preferences → Keyboard Shortcuts` or `Ctrl+K Ctrl+S`

```json
{
  "key": "ctrl+alt+s",
  "command": "github.copilot.chat.sendMessage",
  "args": "@chunk-files search for ${selectedText}",
  "when": "editorTextFocus && editorHasSelection"
}
```

### Snippets for Common Queries

`.vscode/chunks.code-snippets`:

```json
{
  "Search Files": {
    "prefix": "csearch",
    "body": [
      "@chunk-files search for ${1:query}"
    ],
    "description": "Search files with MCP"
  },
  "Upload File": {
    "prefix": "cupload",
    "body": [
      "@chunk-files upload ${1:filename}"
    ]
  }
}
```

## 📚 Resources

- [GitHub Copilot Documentation](https://docs.github.com/copilot)
- [VS Code MCP Integration](https://code.visualstudio.com/docs/editor/artificial-intelligence)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP Server README](../mcp-server/README.md)

## 🎓 Learning Path

1. **Week 1:** Setup and basic commands
   - Install extensions
   - Upload first file
   - Simple searches

2. **Week 2:** Advanced usage
   - Multiple files
   - Document analysis
   - Custom workflows

3. **Week 3:** Integration mastery
   - Debug configurations
   - Custom tasks
   - Shortcuts & snippets

## 💡 Pro Tips

1. **Context is King** - Select relevant code before asking
2. **Iterate Queries** - Refine searches based on results
3. **Verify Processing** - Check file status before analysis
4. **Use Both Interfaces** - Claude for research, Copilot for coding
5. **Organize Files** - Use descriptive filenames for better search

---

**Ready to code with AI-powered file search?** 🚀

Press `Ctrl+Shift+I` and type:
```
@chunk-files help me get started
```
