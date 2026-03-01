import { useEffect } from 'react';
import { useMessageListener, useSendMessage } from '../../hooks/usePostMessage';

export const useIframeSync = (loading: boolean, content: string) => {
  const sendToParent = useSendMessage(window.parent);

  // Signal parent that iframe is ready
  useEffect(() => {
    sendToParent({ type: 'iframe-ready' });
  }, [sendToParent]);

  // Send height to parent for auto-resize
  useEffect(() => {
    if (!loading && content) {
      const sendHeight = () => {
        // Get accurate height accounting for all possible overflow scenarios
        const body = document.body;
        const html = document.documentElement;

        const height = Math.max(
          body.scrollHeight,
          body.offsetHeight,
          html.clientHeight,
          html.scrollHeight,
          html.offsetHeight
        );

        console.log('Iframe height measurements:', {
          bodyScrollHeight: body.scrollHeight,
          bodyOffsetHeight: body.offsetHeight,
          htmlClientHeight: html.clientHeight,
          htmlScrollHeight: html.scrollHeight,
          htmlOffsetHeight: html.offsetHeight,
          finalHeight: height,
        });
        console.log('Sending height to parent:', height);

        sendToParent({ type: 'resize', payload: height });
      };

      // Send height after content loads
      const timer = setTimeout(sendHeight, 100);

      // Use ResizeObserver to detect height changes more accurately
      const resizeObserver = new ResizeObserver(() => {
        sendHeight();
      });

      resizeObserver.observe(document.body);
      resizeObserver.observe(document.documentElement);

      return () => {
        clearTimeout(timer);
        resizeObserver.disconnect();
      };
    }
  }, [loading, content, sendToParent]);

  // Listen for scroll messages from parent
  useMessageListener('scrollToHeading', (message) => {
    const element = document.getElementById(message.payload);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // Listen for text highlight messages from parent (search result click)
  useMessageListener('highlightText', (message) => {
    const query = message.payload as string;
    if (!query || !document.body) {
      return;
    }

    // Remove existing highlights
    document.querySelectorAll('mark.search-highlight').forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });

    const lowerQuery = query.toLowerCase();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);

    const matches: { node: Text; index: number }[] = [];
    let textNode: Text | null;
    while ((textNode = walker.nextNode() as Text | null)) {
      const text = textNode.textContent || '';
      const idx = text.toLowerCase().indexOf(lowerQuery);
      if (idx !== -1) {
        matches.push({ node: textNode, index: idx });
      }
    }

    // Wrap matches in <mark> tags (reverse order to preserve positions)
    for (let i = matches.length - 1; i >= 0; i--) {
      const { node: matchNode, index } = matches[i];
      const text = matchNode.textContent || '';
      const before = document.createTextNode(text.slice(0, index));
      const mark = document.createElement('mark');
      mark.className = 'search-highlight';
      mark.style.backgroundColor = 'rgba(255, 213, 0, 0.5)';
      mark.style.padding = '0.1em 0.2em';
      mark.style.borderRadius = '2px';
      mark.textContent = text.slice(index, index + query.length);
      const after = document.createTextNode(text.slice(index + query.length));

      const parent = matchNode.parentNode;
      if (parent) {
        parent.insertBefore(before, matchNode);
        parent.insertBefore(mark, matchNode);
        parent.insertBefore(after, matchNode);
        parent.removeChild(matchNode);
      }
    }

    // Auto-remove highlights after 8 seconds
    setTimeout(() => {
      document.querySelectorAll('mark.search-highlight').forEach((mark) => {
        const parent = mark.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
          parent.normalize();
        }
      });
    }, 8000);
  });
};
