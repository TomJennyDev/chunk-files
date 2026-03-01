import { useState, useCallback, useEffect } from 'react';
import MarkdownIt from 'markdown-it';
import { useMarkdownHMR } from './useMarkdownHMR';
import { getFileContent } from '../services/api';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface UseMarkdownLoaderOptions {
  sendToIframe: (message: { type: string; payload: string }) => void;
  iframeContentWindow: Window | null;
  /** If provided, fetch the file from S3 via the backend API instead of the static sample.md */
  fileId?: string;
  /** Original file name — needed for s3Key reconstruction fallback */
  fileName?: string;
}

export const useMarkdownLoader = ({ sendToIframe, iframeContentWindow, fileId, fileName }: UseMarkdownLoaderOptions) => {
  const [toc, setToc] = useState<TocItem[]>([]);
  const [markdownText, setMarkdownText] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMarkdown = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let text: string;

      if (fileId) {
        // Fetch from S3 via backend API
        text = await getFileContent(fileId, fileName);
      } else {
        // Fallback: fetch static sample.md
        const response = await fetch(`/sample.md?t=${Date.now()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch markdown');
        }
        text = await response.text();
      }

      setMarkdownText(text);
      
      const md = new MarkdownIt();
      const tokens = md.parse(text, {});
      const tocItems: TocItem[] = [];

      tokens.forEach((token, idx) => {
        if (token.type === 'heading_open') {
          const level = parseInt(token.tag.substring(1), 10);
          const textToken = tokens[idx + 1];
          if (textToken && textToken.type === 'inline') {
            const headingText = textToken.content;
            const headingId = headingText
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-');

            tocItems.push({
              id: headingId,
              text: headingText,
              level,
            });
          }
        }
      });

      setToc(tocItems);
      
      // Send updated content to iframe
      if (iframeContentWindow) {
        sendToIframe({ type: 'markdown-content', payload: text });
      }
    } catch (err) {
      console.error('Error loading markdown:', err);
      setError(err instanceof Error ? err.message : 'Failed to load markdown');
    } finally {
      setLoading(false);
    }
  }, [sendToIframe, iframeContentWindow, fileId, fileName]);

  // Initial load
  useEffect(() => {
    loadMarkdown();
  }, [loadMarkdown]);

  // Listen for markdown HMR events (only for static files, not S3)
  useMarkdownHMR(() => {
    if (!fileId) {
      loadMarkdown();
    }
  });

  return { toc, markdownText, loading, error };
};
