/**
 * Upload File Tool
 * 
 * Handles file uploads to the backend API
 */

import axios from "axios";

interface UploadFileArgs {
  filename: string;
  content: string;
  mimeType: string;
}

export async function uploadFileTool(args: UploadFileArgs, apiBaseUrl: string) {
  const { filename, content, mimeType } = args;

  try {
    // Decode base64 content
    const buffer = Buffer.from(content, "base64");
    
    // Create FormData for multipart upload
    const FormData = (await import("form-data")).default;
    const formData = new FormData();
    
    formData.append("file", buffer, {
      filename,
      contentType: mimeType,
    });

    // Upload to backend
    const response = await axios.post(
      `${apiBaseUrl}/files/upload`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 60000, // 60 seconds
      }
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            fileId: response.data.data.fileId,
            fileName: response.data.data.fileName,
            fileSize: response.data.data.fileSize,
            status: response.data.data.status,
            s3Key: response.data.data.s3Key,
            uploadedAt: response.data.data.uploadedAt,
            message: `✅ File "${filename}" uploaded successfully! Processing started.`,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message;
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: `Failed to upload file: ${errorMsg}`,
            filename,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}
