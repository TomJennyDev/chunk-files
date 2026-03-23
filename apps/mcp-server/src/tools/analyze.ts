/**
 * Analyze Document Tool
 *
 * Perform basic analysis on documents by fetching their chunks from the search API
 */

import axios from "axios";

interface AnalyzeDocumentArgs {
  fileId: string;
  analysisType: "summary" | "topics" | "sentiment" | "entities";
}

export async function analyzeDocumentTool(
  args: AnalyzeDocumentArgs,
  apiBaseUrl: string,
) {
  const { fileId, analysisType } = args;

  try {
    // Fetch chunks for this file via the search endpoint
    const response = await axios.get(`${apiBaseUrl}/search`, {
      params: {
        fileId,
        size: 100,
      },
      timeout: 30000,
    });

    const results = response.data.data?.results || [];

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: `No indexed chunks found for file: ${fileId}. Make sure the file is fully processed (status: completed).`,
                fileId,
                analysisType,
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    // Combine all chunk content
    const fullContent = results.map((r: any) => r.content).join("\n\n");
    const fileName = results[0]?.fileName || "unknown";

    // Perform basic client-side analysis
    let formattedResult: any = {
      success: true,
      fileId,
      fileName,
      analysisType,
      totalChunks: results.length,
    };

    switch (analysisType) {
      case "summary": {
        const wordCount = fullContent.split(/\s+/).length;
        const preview =
          fullContent.substring(0, 500) +
          (fullContent.length > 500 ? "..." : "");
        formattedResult.summary = `Document "${fileName}" contains ${results.length} chunks with approximately ${wordCount} words.`;
        formattedResult.preview = preview;
        formattedResult.message = "📝 Document summary generated";
        break;
      }

      case "topics": {
        // Extract headings from markdown content as topics
        const headings = fullContent.match(/^#{1,6}\s+.+$/gm) || [];
        const topics = headings.map((h: string) =>
          h.replace(/^#+\s+/, "").trim(),
        );
        formattedResult.topics = [...new Set(topics)];
        formattedResult.topicsCount = formattedResult.topics.length;
        formattedResult.message = `🏷️ Extracted ${formattedResult.topicsCount} topics from headings`;
        break;
      }

      case "sentiment": {
        formattedResult.sentiment = {
          label: "neutral",
          note: "Basic analysis — sentiment detection requires an AI/NLP backend",
        };
        formattedResult.message =
          "😊 Basic sentiment analysis (AI backend not available)";
        break;
      }

      case "entities": {
        // Extract code blocks, URLs, and potential entity patterns
        const urls = fullContent.match(/https?:\/\/[^\s)]+/g) || [];
        const codeBlocks = (fullContent.match(/```[\s\S]*?```/g) || []).length;
        formattedResult.entities = {
          urls: [...new Set(urls)],
          codeBlockCount: codeBlocks,
          note: "Basic extraction — full NER requires an AI/NLP backend",
        };
        formattedResult.message = `🔍 Found ${urls.length} URLs and ${codeBlocks} code blocks`;
        break;
      }
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
            text: JSON.stringify(
              {
                success: false,
                error: `File not found with ID: ${fileId}`,
                fileId,
                analysisType,
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
              error: `Analysis failed: ${errorMsg}`,
              fileId,
              analysisType,
              hint: "Make sure the file is fully processed (status: completed) before analyzing",
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
