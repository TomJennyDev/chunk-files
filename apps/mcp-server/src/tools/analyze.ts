/**
 * Analyze Document Tool
 * 
 * Perform AI-powered analysis on documents
 */

import axios from "axios";

interface AnalyzeDocumentArgs {
  fileId: string;
  analysisType: "summary" | "topics" | "sentiment" | "entities";
}

export async function analyzeDocumentTool(args: AnalyzeDocumentArgs, apiBaseUrl: string) {
  const { fileId, analysisType } = args;

  try {
    const response = await axios.post(
      `${apiBaseUrl}/files/${fileId}/analyze`,
      {
        type: analysisType,
      },
      {
        timeout: 60000, // 60 seconds for AI analysis
      }
    );

    const result = response.data;

    // Format result based on analysis type
    let formattedResult: any = {
      success: true,
      fileId,
      analysisType,
    };

    switch (analysisType) {
      case "summary":
        formattedResult.summary = result.result?.summary || result.summary;
        formattedResult.message = "📝 Document summarized successfully";
        break;

      case "topics":
        formattedResult.topics = result.result?.topics || result.topics || [];
        formattedResult.topicsCount = formattedResult.topics.length;
        formattedResult.message = `🏷️ Extracted ${formattedResult.topicsCount} key topics`;
        break;

      case "sentiment":
        formattedResult.sentiment = result.result?.sentiment || result.sentiment;
        formattedResult.message = `😊 Sentiment: ${formattedResult.sentiment?.label} (score: ${formattedResult.sentiment?.score})`;
        break;

      case "entities":
        formattedResult.entities = result.result?.entities || result.entities || [];
        formattedResult.entitiesCount = formattedResult.entities.length;
        formattedResult.message = `🔍 Found ${formattedResult.entitiesCount} named entities`;
        break;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(formattedResult, null, 2),
        },
      ],
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `File not found with ID: ${fileId}`,
              fileId,
              analysisType,
            }, null, 2),
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
          text: JSON.stringify({
            success: false,
            error: `Analysis failed: ${errorMsg}`,
            fileId,
            analysisType,
            hint: "Make sure the file is fully processed (status: completed) before analyzing",
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}
