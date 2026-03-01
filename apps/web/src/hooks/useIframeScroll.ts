import { useCallback } from 'react';

interface UseIframeScrollOptions {
  iframeRef: React.RefObject<HTMLIFrameElement>;
  sendToIframe: (message: { type: string; payload: string }) => void;
}

export const useIframeScroll = ({ iframeRef, sendToIframe }: UseIframeScrollOptions) => {
  const handleTocClick = useCallback((id: string) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) {return;}
    
    try {
      const iframeDoc = iframe.contentWindow.document;
      const element = iframeDoc.getElementById(id);
      
      if (!element) {return;}
      
      // Get absolute position of element in iframe document
      const elementOffsetTop = element.offsetTop;
      
      // Get iframe position relative to parent document
      const iframeOffsetTop = iframe.offsetTop;
      
      // Calculate final scroll position with offset to avoid header overlap
      const SCROLL_OFFSET = 100;
      const targetPosition = iframeOffsetTop + elementOffsetTop - SCROLL_OFFSET;
      
      window.scrollTo({
        top: Math.max(0, targetPosition),
        behavior: 'smooth',
      });
    } catch (e) {
      console.error('Error scrolling to heading:', e);
      // Fallback to postMessage if cross-origin
      sendToIframe({ type: 'scrollToHeading', payload: id });
    }
  }, [iframeRef, sendToIframe]);

  return { handleTocClick };
};
