import { useEffect, useRef } from 'react';
import { useSendMessage } from '../../hooks/usePostMessage';

const REFERENCE_LINE_OFFSET = 150; // px from top of viewport

export const useHeadingHighlight = (
  contentRef: React.RefObject<HTMLDivElement>,
  content: string
) => {
  const sendMessage = useSendMessage(window.parent);
  const currentActiveId = useRef<string>('');

  useEffect(() => {
    if (!content || !contentRef.current) {return;}

    const headings = contentRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (!headings.length) {return;}

    let rafId: number | null = null;

    // Calculate heading position relative to parent window
    const getHeadingPositionInParent = (heading: Element): number => {
      const iframe = window.frameElement as HTMLIFrameElement;
      if (!iframe) {return Infinity;}

      const iframeTop = iframe.getBoundingClientRect().top;
      const headingTop = heading.getBoundingClientRect().top;
      return iframeTop + headingTop;
    };

    // Find heading closest to reference line (already passed)
    const findClosestHeadingPastReference = (): string => {
      let closestId = '';
      let smallestDistance = Infinity;

      for (const heading of Array.from(headings)) {
        const position = getHeadingPositionInParent(heading);
        
        if (position <= REFERENCE_LINE_OFFSET) {
          const distance = Math.abs(REFERENCE_LINE_OFFSET - position);
          
          if (distance < smallestDistance) {
            smallestDistance = distance;
            closestId = heading.id;
          }
        }
      }

      return closestId;
    };

    // Find first visible heading in viewport
    const findFirstVisibleHeading = (): string => {
      const parentHeight = window.parent.innerHeight;

      for (const heading of Array.from(headings)) {
        const position = getHeadingPositionInParent(heading);
        
        if (position >= 0 && position <= parentHeight) {
          return heading.id;
        }
      }

      return '';
    };

    // Determine which heading should be active
    const determineActiveHeading = (): string => {
      // Priority 1: Heading closest to reference line (past it)
      const closestPast = findClosestHeadingPastReference();
      if (closestPast) {return closestPast;}

      // Priority 2: First visible heading in viewport
      const firstVisible = findFirstVisibleHeading();
      if (firstVisible) {return firstVisible;}

      // Priority 3: Default to first heading
      return headings[0]?.id || '';
    };

    // Update active heading and notify parent
    const updateActiveHeading = () => {
      const newActiveId = determineActiveHeading();

      if (newActiveId && newActiveId !== currentActiveId.current) {
        currentActiveId.current = newActiveId;
        sendMessage({ type: 'heading-visible', payload: newActiveId });
      }
    };

    // Throttle scroll updates with RAF
    const handleScroll = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      
      rafId = requestAnimationFrame(() => {
        updateActiveHeading();
        rafId = null;
      });
    };

    // Setup
    window.parent.addEventListener('scroll', handleScroll, { passive: true });
    setTimeout(updateActiveHeading, 100); // Initial check after layout

    // Cleanup
    return () => {
      window.parent.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [content, contentRef, sendMessage]);
};
