import { useEffect } from 'react';

interface MarkdownUpdateData {
  path: string;
  timestamp: number;
}

export function useMarkdownHMR(onUpdate: (data: MarkdownUpdateData) => void) {
  useEffect(() => {
    if (import.meta.hot) {
      // Listen for markdown update events
      import.meta.hot.on('markdown-update', (data: MarkdownUpdateData) => {
        console.log('Markdown file updated:', data.path);
        onUpdate(data);
      });

      // Listen for markdown added events
      import.meta.hot.on('markdown-added', (data: MarkdownUpdateData) => {
        console.log('Markdown file added:', data.path);
        onUpdate(data);
      });

      // Listen for markdown removed events
      import.meta.hot.on('markdown-removed', (data: MarkdownUpdateData) => {
        console.log('Markdown file removed:', data.path);
        onUpdate(data);
      });
    }

    return () => {
      if (import.meta.hot) {
        import.meta.hot.dispose(() => {
          console.log('Cleaning up markdown HMR listeners');
        });
      }
    };
  }, [onUpdate]);
}
