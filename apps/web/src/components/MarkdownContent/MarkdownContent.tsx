import { useRef } from 'react';
import { Box, Text, Paper } from '@mantine/core';
import { useSearchParams } from 'react-router-dom';
import { useHeadingHighlight } from './useHeadingHighlight';
import { useHeadingClick } from './useHeadingClick';
import { useMarkdownContent } from './useMarkdownContent';
import { useIframeSync } from './useIframeSync';
import { useScrollToHeading } from './useScrollToHeading';
import { DynamicContent } from './DynamicContent';

export function MarkdownContent() {
  const contentRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const fileId = searchParams.get('fileId') || undefined;

  // Load and manage markdown content (from S3 if fileId provided, fallback to sample.md)
  const { content, loading, error } = useMarkdownContent({ fileId });

  // Sync iframe with parent window
  useIframeSync(loading, content);

  // Heading highlight on scroll
  useHeadingHighlight(contentRef, content);

  // Heading click to scroll
  useHeadingClick(contentRef, content);

  // Scroll to heading from search results (URL params)
  useScrollToHeading(contentRef, content);

  if (loading) {
    return <Text>Loading markdown...</Text>;
  }

  if (error) {
    return <Text c="red">Error: {error}</Text>;
  }

  return (
    <Box style={{ minHeight: '100vh', padding: '1rem' }}>
      <Paper shadow="sm" p="xl">
        <div
          ref={contentRef}
          dangerouslySetInnerHTML={{ __html: content }}
          style={{
            lineHeight: 1.6,
          }}
          className="markdown-content"
        />
        
        {/* Dynamic content that causes height changes - for testing ResizeObserver */}
        <DynamicContent />
      </Paper>

      <style>{`
        .markdown-content h1,
        .markdown-content h2,
        .markdown-content h3,
        .markdown-content h4,
        .markdown-content h5,
        .markdown-content h6 {
          margin-top: 1.5rem;
          margin-bottom: 1rem;
          font-weight: 600;
          scroll-margin-top: 1rem;
          cursor: pointer;
          transition: color 0.2s ease;
        }

        .markdown-content h1:hover,
        .markdown-content h2:hover,
        .markdown-content h3:hover,
        .markdown-content h4:hover,
        .markdown-content h5:hover,
        .markdown-content h6:hover {
          color: #228be6;
        }

        .markdown-content h1 {
          font-size: 2rem;
          border-bottom: 2px solid #e0e0e0;
          padding-bottom: 0.5rem;
          margin-top: 3rem;
          margin-bottom: 2rem;
        }

        .markdown-content h2 {
          font-size: 1.5rem;
          border-bottom: 1px solid #e0e0e0;
          padding-bottom: 0.3rem;
          margin-top: 2.5rem;
          margin-bottom: 1.5rem;
        }

        .markdown-content h3 {
          font-size: 1.25rem;
          margin-top: 2rem;
          margin-bottom: 1.2rem;
        }

        .markdown-content p {
          margin-top: 1rem;
          margin-bottom: 1.5rem;
        }

        .markdown-content ul,
        .markdown-content ol {
          margin-bottom: 1rem;
          padding-left: 2rem;
        }

        .markdown-content li {
          margin-bottom: 0.5rem;
        }

        .markdown-content code {
          background-color: #f5f5f5;
          padding: 0.2rem 0.4rem;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
          font-size: 0.9em;
        }

        .markdown-content pre {
          background-color: #f5f5f5;
          padding: 1rem;
          border-radius: 5px;
          overflow-x: auto;
          margin-bottom: 1rem;
        }

        .markdown-content pre code {
          background-color: transparent;
          padding: 0;
        }

        .markdown-content table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 1rem;
        }

        .markdown-content table th,
        .markdown-content table td {
          border: 1px solid #ddd;
          padding: 0.75rem;
          text-align: left;
        }

        .markdown-content table th {
          background-color: #f5f5f5;
          font-weight: 600;
        }

        .markdown-content blockquote {
          border-left: 4px solid #ddd;
          padding-left: 1rem;
          margin-left: 0;
          margin-bottom: 1rem;
          color: #666;
          font-style: italic;
        }

        .markdown-content a {
          color: #228be6;
          text-decoration: none;
        }

        .markdown-content a:hover {
          text-decoration: underline;
        }

        .markdown-content hr {
          border: none;
          border-top: 2px solid #e0e0e0;
          margin: 2rem 0;
        }

        .markdown-content img {
          max-width: 100%;
          height: auto;
        }

        /* Scroll target highlight animation */
        .search-scroll-target {
          animation: scrollHighlightPulse 3s ease-out;
          border-radius: 4px;
        }

        @keyframes scrollHighlightPulse {
          0% { background-color: rgba(34, 139, 230, 0.3); }
          50% { background-color: rgba(34, 139, 230, 0.15); }
          100% { background-color: transparent; }
        }

        /* Search text highlight */
        mark.search-highlight {
          background-color: rgba(255, 213, 0, 0.5);
          padding: 0.1em 0.2em;
          border-radius: 2px;
          transition: background-color 0.5s ease;
        }
      `}</style>
    </Box>
  );
}
