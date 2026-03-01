#!/usr/bin/env node

/**
 * Chunk Files MCP Server
 * 
 * Model Context Protocol server for AI-powered file processing and search.
 * Provides tools and resources for uploading, searching, and analyzing documents.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import * as dotenv from "dotenv";
import { uploadFileTool } from "./tools/upload.js";
import { searchFilesTool } from "./tools/search.js";
import { getFileStatusTool } from "./tools/status.js";
import { analyzeDocumentTool } from "./tools/analyze.js";
import { listFilesResource, readFileResource } from "./resources/files.js";

// Load environment variables
dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

// Create MCP server instance
const server = new Server(
  {
    name: "chunk-files-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "upload_file",
        description: "Upload a file to S3 storage and queue for processing. Supports PDF, DOCX, TXT, MD, JSON, XML, CSV formats up to 500MB.",
        inputSchema: {
          type: "object",
          properties: {
            filename: {
              type: "string",
              description: "Name of the file including extension (e.g., 'document.pdf')",
            },
            content: {
              type: "string",
              description: "Base64 encoded file content",
            },
            mimeType: {
              type: "string",
              description: "MIME type of the file (e.g., 'application/pdf', 'text/plain')",
              enum: [
                "application/pdf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/msword",
                "text/plain",
                "text/markdown",
                "application/json",
                "application/xml",
                "text/xml",
                "text/csv",
              ],
            },
          },
          required: ["filename", "content", "mimeType"],
        },
      },
      {
        name: "search_files",
        description: "Search through uploaded files using natural language or keywords. Returns relevant chunks with context.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query in natural language (e.g., 'neural networks and transformers')",
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (default: 10, max: 100)",
              default: 10,
              minimum: 1,
              maximum: 100,
            },
            offset: {
              type: "number",
              description: "Number of results to skip for pagination (default: 0)",
              default: 0,
              minimum: 0,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_file_status",
        description: "Get the current processing status and metadata of a file by its ID",
        inputSchema: {
          type: "object",
          properties: {
            fileId: {
              type: "string",
              description: "Unique identifier of the file (UUID format)",
            },
          },
          required: ["fileId"],
        },
      },
      {
        name: "analyze_document",
        description: "Perform AI-powered analysis on a document. Extract summary, topics, sentiment, or named entities.",
        inputSchema: {
          type: "object",
          properties: {
            fileId: {
              type: "string",
              description: "File ID to analyze",
            },
            analysisType: {
              type: "string",
              enum: ["summary", "topics", "sentiment", "entities"],
              description: "Type of analysis: summary (text summarization), topics (key topics extraction), sentiment (positive/negative/neutral), entities (named entity recognition)",
            },
          },
          required: ["fileId", "analysisType"],
        },
      },
    ],
  };
});

/**
 * Execute tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "upload_file":
        return await uploadFileTool(args as any, API_BASE_URL);

      case "search_files":
        return await searchFilesTool(args as any, API_BASE_URL);

      case "get_file_status":
        return await getFileStatusTool(args as any, API_BASE_URL);

      case "analyze_document":
        return await analyzeDocumentTool(args as any, API_BASE_URL);

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error: any) {
    // Handle errors gracefully
    const errorMessage = error instanceof McpError 
      ? error.message 
      : error.message || "An unknown error occurred";

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: errorMessage,
            tool: name,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

/**
 * List available resources (files)
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return await listFilesResource(API_BASE_URL);
});

/**
 * Read resource content
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  return await readFileResource(request.params.uri, API_BASE_URL);
});

/**
 * Start the MCP server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log to stderr (stdout is reserved for MCP protocol)
  console.error("🚀 Chunk Files MCP Server started");
  console.error(`📡 Connected to API: ${API_BASE_URL}`);
  console.error("✅ Ready to process requests");
}

// Handle errors
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start server
main().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
