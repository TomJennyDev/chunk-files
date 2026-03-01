import { Paper, Text, ScrollArea, Stack, Anchor } from '@mantine/core';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  items: TocItem[];
  onItemClick: (id: string) => void;
  activeId?: string;
}

export function TableOfContents({ items, onItemClick, activeId }: TableOfContentsProps) {
  return (
    <Paper
      shadow="sm"
      p="md"
      style={{
        width: '250px',
        position: 'sticky',
        top: '80px',
        height: 'fit-content',
        maxHeight: 'calc(100vh - 100px)',
        overflow: 'auto',
        alignSelf: 'flex-start',
      }}
    >
      <Text fw={700} size="lg" mb="md">
        Table of Contents
      </Text>
      <ScrollArea>
        <Stack gap="xs">
          {items.map((item, index) => (
            <Anchor
              key={`${item.id}-${index}`}
              onClick={() => onItemClick(item.id)}
              style={{
                fontSize: item.level === 1 ? '0.95rem' : '0.875rem',
                fontWeight: item.id === activeId ? 700 : item.level === 1 ? 600 : 400,
                cursor: 'pointer',
                display: 'block',
                textDecoration: 'none',
                backgroundColor: item.id === activeId ? '#e7f5ff' : 'transparent',
                padding: `6px 12px 6px ${(item.level - 1) * 16 + 12}px`,
                borderRadius: '4px',
                transition: 'all 0.15s ease',
                color: item.id === activeId ? '#1971c2' : '#228be6',
              }}
            >
              {item.text}
            </Anchor>
          ))}
        </Stack>
      </ScrollArea>
    </Paper>
  );
}
