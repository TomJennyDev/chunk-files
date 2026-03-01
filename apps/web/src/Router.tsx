import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './Layout';
import { HomePage } from './pages/Home.page';
import { IFramePage } from './pages/IFrame.page';
import { MarkdownPage } from './pages/Markdown';
import { SearchPage } from './pages/Search.page';
import { UploadPage } from './pages/Upload.page';

const router = createBrowserRouter([
  {
    path: '/markdown-view',
    element: <MarkdownPage />,
  },
  {
    element: <Layout />,
    children: [
      {
        path: '/',
        element: <HomePage />,
      },
      {
        path: '/markdown',
        element: <MarkdownPage />,
      },
      {
        path: '/iframe',
        element: <IFramePage />,
      },
      {
        path: '/upload',
        element: <UploadPage />,
      },
      {
        path: '/search',
        element: <SearchPage />,
      },
    ],
  },
]);

export function Router() {
  return <RouterProvider router={router} />;
}
