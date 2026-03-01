import { AppShell, Group, Title, Button } from '@mantine/core';
import { Link, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={3}>Markdown iFrame App</Title>
          <Group gap="sm">
            <Button component={Link} to="/" variant="subtle">
              Home
            </Button>
            <Button component={Link} to="/markdown" variant="subtle">
              Markdown Viewer
            </Button>
            <Button component={Link} to="/iframe" variant="subtle">
              IFrame Viewer
            </Button>
            <Button component={Link} to="/upload" variant="subtle">
              Upload
            </Button>
            <Button component={Link} to="/search" variant="subtle">
              Search
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
