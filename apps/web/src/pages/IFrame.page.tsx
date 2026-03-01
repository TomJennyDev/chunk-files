import { Box } from '@mantine/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TableOfContents } from '../components/TableOfContents/TableOfContents';
import { useMultipleMessageListeners, useSendMessage } from '../hooks/usePostMessage';
import { useMarkdownLoader } from '../hooks/useMarkdownLoader';
import { useIframeScroll } from '../hooks/useIframeScroll';

export function IFramePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeId, setActiveId] = useState<string>('');
  const [searchParams, setSearchParams] = useSearchParams();
  const pendingScrollRef = useRef<{ heading?: string; query?: string } | null>(null);
  const sendToIframe = useSendMessage(iframeRef.current?.contentWindow || null);

  // Read search params from URL (set by search result click)
  useEffect(() => {
    const heading = searchParams.get('heading');
    const query = searchParams.get('q');
    if (heading || query) {
      pendingScrollRef.current = { heading: heading || undefined, query: query || undefined };
    }
  }, [searchParams]);

  // Load markdown and parse TOC
  const fileId = searchParams.get('fileId') || undefined;
  const fileName = searchParams.get('fileName') || undefined;
  const { toc, markdownText } = useMarkdownLoader({
    sendToIframe,
    iframeContentWindow: iframeRef.current?.contentWindow || null,
    fileId,
    fileName,
  });

  // Handle scroll to heading
  const { handleTocClick } = useIframeScroll({
    iframeRef,
    sendToIframe,
  });

  // Scroll to search-result heading after iframe content is loaded
  const scrollToSearchResult = useCallback(() => {
    const pending = pendingScrollRef.current;
    if (!pending) { return; }

    // Small delay to let the iframe render its HTML
    setTimeout(() => {
      if (pending.heading) {
        handleTocClick(pending.heading);
        setActiveId(pending.heading);
      }
      // Send highlight command to iframe
      if (pending.query) {
        sendToIframe({ type: 'highlightText', payload: pending.query });
      }
      pendingScrollRef.current = null;

      // Clean up URL params
      setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 3000);
    }, 400);
  }, [handleTocClick, sendToIframe, setSearchParams]);

  // Listen for messages from iframe with type safety
  useMultipleMessageListeners({
    resize: (message) => {
      if (iframeRef.current) {
        iframeRef.current.style.height = `${message.payload}px`;
      }
    },
    'iframe-ready': () => {
      if (markdownText) {
        sendToIframe({ type: 'markdown-content', payload: markdownText });
        // After sending content, scroll to search result if pending
        scrollToSearchResult();
      }
    },
    'heading-visible': (message) => {
      setActiveId(message.payload);
    },
    'scrollToHeadingFromIframe': (message) => {
      handleTocClick(message.payload);
    },
  });

  return (
    <Box style={{ display: 'flex', gap: '1rem', minHeight: '100vh' }}>
      <TableOfContents items={toc} onItemClick={handleTocClick} activeId={activeId} />
      <Box style={{ flex: 1 }}>
        <iframe
          ref={iframeRef}
          src="http://localhost:5173/markdown-view"
          style={{
            width: '100%',
            border: 'none',
            display: 'block',
          }}
          scrolling="no"
          title="Markdown Viewer in IFrame"
        />
      </Box>
    </Box>
  );
}
