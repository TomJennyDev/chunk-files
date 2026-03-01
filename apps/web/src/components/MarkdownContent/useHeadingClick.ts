import { useEffect } from 'react';
import { useSendMessage } from '../../hooks/usePostMessage';

export const useHeadingClick = (
  contentRef: React.RefObject<HTMLDivElement>,
  content: string
) => {
  const sendToParent = useSendMessage(window.parent);

  useEffect(() => {
    if (!content || !contentRef.current) {return;}

    const handleHeadingClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (target.tagName.match(/^H[1-6]$/)) {
        event.preventDefault();
        const headingId = target.id;
        if (headingId) {
          sendToParent({ type: 'scrollToHeadingFromIframe', payload: headingId });
        }
      }
    };

    const contentElement = contentRef.current;
    contentElement.addEventListener('click', handleHeadingClick);

    return () => {
      contentElement.removeEventListener('click', handleHeadingClick);
    };
  }, [content, contentRef, sendToParent]);
};
