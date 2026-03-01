import { Container, Button, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { ColorSchemeToggle } from '../components/ColorSchemeToggle/ColorSchemeToggle';
import { Welcome } from '../components/Welcome/Welcome';

export function HomePage() {
  return (
    <Container>
      <Welcome />
      <Stack mt="xl" gap="md">
        <Text size="lg">
          This app demonstrates markdown rendering with table of contents and sidebar navigation.
        </Text>
        <Button component={Link} to="/markdown" size="lg">
          View Markdown Example
        </Button>
      </Stack>
      <ColorSchemeToggle />
    </Container>
  );
}
