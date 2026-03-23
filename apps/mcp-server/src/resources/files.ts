/**
 * File Resources
 *
 * Expose uploaded files as MCP resources
 */

import axios from "axios";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

/**
 * List all files as resources
 * Note: Backend doesn't have a dedicated list-all-files route,
 * so we use search with a wildcard to discover files.
 */
export async function listFilesResource(apiBaseUrl: string) {
  try {
    const response = await axios.get(`${apiBaseUrl}/search`, {
      params: {
        page: 0,
        size: 100,
      },
      timeout: 10000,
    });

    const results = response.data.data?.results || [];

    // Deduplicate by fileId
    const filesMap = new Map<string, any>();
    for (const result of results) {
      if (result.fileId && !filesMap.has(result.fileId)) {
        filesMap.set(result.fileId, result);
      }
    }

    return {
      resources: Array.from(filesMap.values()).map((file: any) => ({
        uri: `file://${file.fileId}`,
        name: file.fileName || "unknown",
        description: `File: ${file.fileName}`,
        mimeType: "application/octet-stream",
      })),
    };
  } catch (error: any) {
    console.error("Failed to list files:", error.message);
    return {
      resources: [],
    };
  }
}

/**
 * Read file resource content
 */
export async function readFileResource(uri: string, apiBaseUrl: string) {
  const match = uri.match(/^file:\/\/(.+)$/);

  if (!match) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Invalid resource URI: ${uri}. Expected format: file://{fileId}`,
    );
  }

  const fileId = match[1];

  try {
    // Get file metadata
    const statusResponse = await axios.get(
      `${apiBaseUrl}/files/${fileId}/status`,
      { timeout: 10000 },
    );

    const fileData = statusResponse.data.data;

    // Try to get file chunks if processed
    let chunks: any[] = [];
    if (fileData.status === "completed") {
      try {
        const searchResponse = await axios.get(`${apiBaseUrl}/files/search`, {
          params: {
            fileId: fileId,
            size: 100,
          },
          timeout: 10000,
        });
        chunks = searchResponse.data.data?.results || [];
      } catch (error) {
        // Chunks not available yet
        console.error("Failed to get chunks:", error);
      }
    }

    // Combine metadata and content
    const content = {
      metadata: {
        fileId: fileData.fileId,
        fileName: fileData.fileName,
        status: fileData.status,
        uploadedAt: fileData.uploadedAt,
        totalChunks: fileData.totalChunks,
        processedChunks: fileData.processedChunks,
      },
      chunks: chunks.map((chunk: any) => ({
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        startByte: chunk.startByte,
        endByte: chunk.endByte,
      })),
      fullText: chunks
        .sort((a: any, b: any) => a.chunkIndex - b.chunkIndex)
        .map((c: any) => c.content)
        .join("\n\n"),
    };

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(content, null, 2),
        },
      ],
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new McpError(ErrorCode.InvalidRequest, `File not found: ${fileId}`);
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Failed to read file resource: ${error.message}`,
    );
  }
}

// Utility: Format bytes to human readable string (exported for potential future use)
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
