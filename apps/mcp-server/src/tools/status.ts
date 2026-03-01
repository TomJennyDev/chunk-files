/**
 * Get File Status Tool
 *
 * Retrieve processing status and metadata for a file
 */

import axios from "axios";

interface GetFileStatusArgs {
  fileId: string;
}

export async function getFileStatusTool(
  args: GetFileStatusArgs,
  apiBaseUrl: string,
) {
  const { fileId } = args;

  try {
    const response = await axios.get(`${apiBaseUrl}/files/${fileId}/status`, {
      timeout: 10000, // 10 seconds
    });

    const fileData = response.data.data;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              fileId: fileData.fileId,
              fileName: fileData.fileName,
              status: fileData.status,
              totalChunks: fileData.totalChunks,
              processedChunks: fileData.processedChunks,
              progress:
                fileData.progress != null
                  ? `${fileData.progress}%`
                  : fileData.totalChunks
                    ? `${Math.round((fileData.processedChunks / fileData.totalChunks) * 100)}%`
                    : "N/A",
              error: fileData.error,
              uploadedAt: fileData.uploadedAt,
              message: `\uD83D\uDCCA File status: ${fileData.status?.toUpperCase()}`,
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: `File not found with ID: ${fileId}`,
                fileId,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    const errorMsg = error.response?.data?.message || error.message;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error: `Failed to get file status: ${errorMsg}`,
              fileId,
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
