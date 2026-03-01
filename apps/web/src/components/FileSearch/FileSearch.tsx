import { useCallback, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Pagination,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import MarkdownIt from 'markdown-it';
import { useNavigate } from 'react-router-dom';
import { searchFiles, type SearchResult } from '../../services/api';

const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

export function FileSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [took, setTook] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const PAGE_SIZE = 10;

  const doSearch = useCallback(
    async (searchPage = 1) => {
      if (!query.trim()) {return;}

      setLoading(true);
      setError(null);
      setHasSearched(true);

      try {
        const res = await searchFiles({
          text: query.trim(),
          page: searchPage,
          size: PAGE_SIZE,
        });

        setResults(res.data.results);
        setTotal(res.data.total);
        setTook(res.data.took);
        setPage(searchPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [query]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(1);
  };

  const handlePageChange = (newPage: number) => {
    doSearch(newPage);
  };

  const toggleExpand = (key: string) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderContent = (content: string, expanded: boolean) => {
    const maxLen = 300;
    const display = expanded || content.length <= maxLen ? content : `${content.slice(0, maxLen)  }...`;
    return md.render(display);
  };

  const handleResultClick = (result: SearchResult) => {
    const params = new URLSearchParams();
    // Use heading ID if available, otherwise generate from heading text
    if (result.heading?.id) {
      params.set('heading', result.heading.id);
    } else if (result.heading?.text) {
      const headingId = result.heading.text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      params.set('heading', headingId);
    }
    // Pass search query for text highlighting
    params.set('q', query.trim());
    params.set('fileId', result.fileId);
    params.set('fileName', result.fileName);
    params.set('chunk', String(result.chunkIndex));

    navigate(`/iframe?${params.toString()}`);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Stack gap="lg">
      <Title order={2}>Search Files</Title>
      <Text c="dimmed">
        Search through uploaded and indexed documents using full-text search.
      </Text>

      {/* Search form */}
      <form onSubmit={handleSubmit}>
        <Group gap="sm" align="flex-end">
          <TextInput
            ref={inputRef}
            placeholder="Enter search query..."
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.currentTarget.value)}
            style={{ flex: 1 }}
            size="md"
          />
          <Button type="submit" size="md" loading={loading}>
            Search
          </Button>
        </Group>
      </form>

      {/* Error */}
      {error && (
        <Card withBorder bg="red.0" c="red.9">
          <Text fw={500}>Search Error</Text>
          <Text size="sm">{error}</Text>
        </Card>
      )}

      {/* Results */}
      {hasSearched && !loading && !error && (
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {total > 0
                ? `Found ${total} result${total > 1 ? 's' : ''} in ${took}ms`
                : 'No results found'}
            </Text>
          </Group>

          {results.map((result) => {
            const key = `${result.fileId}-${result.chunkIndex}`;
            const expanded = expandedChunks.has(key);

            return (
              <Tooltip label="Click to view in document" position="top" withArrow>
                <Card
                  key={key}
                  withBorder
                  shadow="xs"
                  padding="md"
                  onClick={() => handleResultClick(result)}
                  style={{ cursor: 'pointer', transition: 'box-shadow 0.15s ease' }}
                  onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                    e.currentTarget.style.boxShadow = '0 0 0 2px var(--mantine-color-blue-4)';
                  }}
                  onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                    e.currentTarget.style.boxShadow = '';
                  }}
                >
                <Stack gap="xs">
                  {/* Header */}
                  <Group justify="space-between" wrap="wrap">
                    <Group gap="xs">
                      <Text fw={600} size="sm">
                        {result.fileName}
                      </Text>
                      {result.heading && (
                        <Badge variant="light" size="sm">
                          {result.heading.text}
                        </Badge>
                      )}
                    </Group>
                    <Group gap="xs">
                      <Badge variant="outline" size="xs" color="gray">
                        Chunk #{result.chunkIndex}
                      </Badge>
                      {result.score !== undefined && (
                        <Badge variant="outline" size="xs" color="blue">
                          Score: {result.score.toFixed(2)}
                        </Badge>
                      )}
                    </Group>
                  </Group>

                  {/* Content preview */}
                  <Box
                    className="markdown-content"
                    style={{
                      fontSize: '0.875rem',
                      maxHeight: expanded ? 'none' : '200px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: renderContent(result.content, expanded),
                    }}
                  />

                  {/* Expand/collapse */}
                  {result.content.length > 300 && (
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        toggleExpand(key);
                      }}
                    >
                      {expanded ? 'Show less' : 'Show more'}
                    </Button>
                  )}

                  {/* File ID */}
                  <Text size="xs" c="dimmed">
                    File ID: {result.fileId}
                  </Text>
                </Stack>
              </Card>
              </Tooltip>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <Group justify="center" mt="md">
              <Pagination
                value={page}
                onChange={handlePageChange}
                total={totalPages}
              />
            </Group>
          )}
        </Stack>
      )}

      {/* Loading state */}
      {loading && (
        <Group justify="center" py="xl">
          <Loader size="md" />
          <Text c="dimmed">Searching...</Text>
        </Group>
      )}
    </Stack>
  );
}
