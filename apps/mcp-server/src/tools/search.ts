/**
 * Search Files Tool
 *
 * Search through uploaded files using natural language
 */

import axios from "axios";

interface SearchFilesArgs {
  query: string;
  limit?: number;
  offset?: number;
}

export async function searchFilesTool(
  args: SearchFilesArgs,
  apiBaseUrl: string,
) {
  const { query, limit = 10, offset = 0 } = args;

  try {
    const response = await axios.get(`${apiBaseUrl}/files/search`, {
      params: {
        text: query,
        page: Math.floor(offset / Math.min(limit, 100)),
        size: Math.min(limit, 100), // Cap at 100
      },
      timeout: 30000, // 30 seconds
    });

    const results = response.data.data;

    // Format results for better readability
    const formattedResults =
      results.results?.map((item: any, index: number) => ({
        rank: offset + index + 1,
        fileId: item.fileId,
        fileName: item.fileName,
        chunkIndex: item.chunkIndex,
        content: item.content,
        startByte: item.startByte,
        endByte: item.endByte,
      })) || [];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              query,
              total: results.total || 0,
              returned: formattedResults.length,
              page: results.page || 0,
              took: results.took,
              results: formattedResults,
              message: `\uD83D\uDD0D Found ${results.total || 0} results for "${query}"`,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error: `Search failed: ${errorMsg}`,
              query,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
}
