import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Hook that reads `heading` and `q` from URL search params,
 * scrolls to the matching heading element, and highlights the
 * search query text within the content area.
 */
export const useScrollToHeading = (
  contentRef: React.RefObject<HTMLDivElement>,
  content: string
) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const hasScrolled = useRef(false);

  useEffect(() => {
    if (!content || !contentRef.current) {
      return;
    }

    const headingId = searchParams.get('heading');
    const searchQuery = searchParams.get('q');

    if (!headingId && !searchQuery) {
      return;
    }
    // Only scroll once per navigation
    if (hasScrolled.current) {
      return;
    }

    // Wait for the DOM to settle after rendering
    const timer = setTimeout(() => {
      let scrollTarget: HTMLElement | null = null;

      // 1. Try to find heading by ID
      if (headingId) {
        scrollTarget = contentRef.current?.querySelector(
          `#${CSS.escape(headingId)}`
        ) as HTMLElement | null;
      }

      // 2. If heading not found, try text content matching
      if (!scrollTarget && searchQuery) {
        scrollTarget = findTextInContent(contentRef.current!, searchQuery);
      }

      if (scrollTarget) {
        // Scroll to the target
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Add highlight effect
        scrollTarget.classList.add('search-scroll-target');
        setTimeout(() => {
          scrollTarget?.classList.remove('search-scroll-target');
        }, 3000);

        hasScrolled.current = true;
      }

      // Highlight matching text in the content area
      if (searchQuery) {
        highlightSearchText(contentRef.current!, searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [content, contentRef, searchParams]);

  // Reset scroll flag when search params change
  useEffect(() => {
    hasScrolled.current = false;
  }, [searchParams]);

  // Clean up: remove search params from URL after scrolling (optional)
  useEffect(() => {
    const headingId = searchParams.get('heading');
    const searchQuery = searchParams.get('q');

    if ((headingId || searchQuery) && hasScrolled.current) {
      // Remove search-related params after a delay to keep URL clean
      const cleanup = setTimeout(() => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('heading');
        newParams.delete('q');
        newParams.delete('fileId');
        newParams.delete('chunk');
        if (newParams.toString() === '') {
          setSearchParams({}, { replace: true });
        } else {
          setSearchParams(newParams, { replace: true });
        }
      }, 5000);
      return () => clearTimeout(cleanup);
    }
  }, [hasScrolled.current, searchParams, setSearchParams]);
};

/**
 * Find the first element containing the search text
 */
function findTextInContent(container: HTMLElement, query: string): HTMLElement | null {
  const lowerQuery = query.toLowerCase();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (node.textContent && node.textContent.toLowerCase().includes(lowerQuery)) {
      // Return the parent element of the matching text node
      const parent = node.parentElement;
      if (parent) {
        // Walk up to find a block-level parent for better scroll positioning
        let block = parent;
        while (block.parentElement && block.parentElement !== container) {
          const display = window.getComputedStyle(block).display;
          if (display === 'block' || display === 'list-item' || display === 'table') {
            break;
          }
          block = block.parentElement;
        }
        return block;
      }
    }
  }
  return null;
}

/**
 * Highlight matching search text by wrapping matches in <mark> tags.
 * Uses a TreeWalker to find text nodes and wraps matches.
 */
function highlightSearchText(container: HTMLElement, query: string): void {
  // Remove any existing highlights first
  container.querySelectorAll('mark.search-highlight').forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
      parent.normalize();
    }
  });

  if (!query.trim()) {
    return;
  }

  const lowerQuery = query.toLowerCase();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);

  const matches: { node: Text; index: number }[] = [];
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent || '';
    const idx = text.toLowerCase().indexOf(lowerQuery);
    if (idx !== -1) {
      matches.push({ node, index: idx });
    }
  }

  // Process matches in reverse order to avoid invalidating positions
  for (let i = matches.length - 1; i >= 0; i--) {
    const { node: textNode, index } = matches[i];
    const text = textNode.textContent || '';

    const before = document.createTextNode(text.slice(0, index));
    const mark = document.createElement('mark');
    mark.className = 'search-highlight';
    mark.textContent = text.slice(index, index + query.length);
    const after = document.createTextNode(text.slice(index + query.length));

    const parent = textNode.parentNode;
    if (parent) {
      parent.insertBefore(before, textNode);
      parent.insertBefore(mark, textNode);
      parent.insertBefore(after, textNode);
      parent.removeChild(textNode);
    }
  }

  // Auto-remove highlights after some time
  setTimeout(() => {
    container.querySelectorAll('mark.search-highlight').forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });
  }, 8000);
}
