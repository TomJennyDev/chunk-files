import { useEffect, useState } from 'react';
import { Box, ScrollArea, Text, Paper, Anchor, Stack } from '@mantine/core';
import MarkdownIt from 'markdown-it';

interface MarkdownRendererProps {
  url: string;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function MarkdownRenderer({ url }: MarkdownRendererProps) {
  const [content, setContent] = useState<string>('');
  const [toc, setToc] = useState<TocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch markdown file');
        }
        return response.text();
      })
      .then((text) => {
        const md = new MarkdownIt({
          html: true,
          linkify: true,
          typographer: true,
        });

        // Extract headings for table of contents
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

        // Custom renderer to add IDs to headings
        const defaultRender = md.renderer.rules.heading_open || function(tokens, idx, options, _env, self) {
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

        const html = md.render(text);
        setContent(html);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [url]);

  const handleTocClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading) {
    return <Text>Loading markdown...</Text>;
  }

  if (error) {
    return <Text c="red">Error: {error}</Text>;
  }

  return (
    <Box style={{ display: 'flex', gap: '1rem', minHeight: '100vh' }}>
      {/* Table of Contents Sidebar */}
      <Paper 
        shadow="sm" 
        p="md" 
        style={{ 
          width: '250px', 
          position: 'sticky', 
          top: '0px',
          height: 'fit-content',
          maxHeight: '100vh',
          overflow: 'auto',
          alignSelf: 'flex-start'
        }}
      >
        <Text fw={700} size="lg" mb="md">
          Table of Contents
        </Text>
        <ScrollArea>
          <Stack gap="xs">
            {toc.map((item, index) => (
              <Anchor
                key={index}
                onClick={() => handleTocClick(item.id)}
                style={{
                  paddingLeft: `${(item.level - 1) * 12}px`,
                  fontSize: item.level === 1 ? '0.95rem' : '0.875rem',
                  fontWeight: item.level === 1 ? 600 : 400,
                  cursor: 'pointer',
                  display: 'block',
                  textDecoration: 'none',
                }}
                c="blue"
              >
                {item.text}
              </Anchor>
            ))}
          </Stack>
        </ScrollArea>
      </Paper>

      {/* Markdown Content */}
      <Box style={{ flex: 1, minHeight: '100%' }}>
        <Paper shadow="sm" p="xl">
          <div
            dangerouslySetInnerHTML={{ __html: content }}
            style={{
              lineHeight: 1.6,
            }}
            className="markdown-content"
          />
        </Paper>
      </Box>

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
        }

        .markdown-content h1 {
          font-size: 2rem;
          border-bottom: 2px solid #e0e0e0;
          padding-bottom: 0.5rem;
        }

        .markdown-content h2 {
          font-size: 1.5rem;
          border-bottom: 1px solid #e0e0e0;
          padding-bottom: 0.3rem;
        }

        .markdown-content h3 {
          font-size: 1.25rem;
        }

        .markdown-content p {
          margin-bottom: 1rem;
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
      `}</style>
    </Box>
  );
}
