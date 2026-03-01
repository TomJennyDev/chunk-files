import { useCallback } from 'react';
import MarkdownIt from 'markdown-it';

/**
 * Custom hook for rendering markdown with custom heading IDs
 * @returns A function that converts markdown text to HTML
 */
export const useMarkdownRenderer = () => {
  const renderMarkdown = useCallback((text: string): string => {
    const md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
    });

    // Custom renderer to add IDs to headings
    const defaultRender =
      md.renderer.rules.heading_open ||
      function (tokens, idx, options, _env, self) {
        return self.renderToken(tokens, idx, options);
      };

    md.renderer.rules.heading_open = function (tokens, idx, options, _env, self) {
      const token = tokens[idx];
      const textToken = tokens[idx + 1];

      if (textToken && textToken.type === 'inline') {
        const headingText = textToken.content;
        const headingId = headingText
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-');

        token.attrSet('id', headingId);
      }

      return defaultRender(tokens, idx, options, _env, self);
    };

    return md.render(text);
  }, []);

  return renderMarkdown;
};
