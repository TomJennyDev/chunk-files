import { useCallback, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Progress,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { getFileStatus, uploadFile, type UploadResponse } from '../../services/api';

interface UploadedFile {
  fileId: string;
  fileName: string;
  fileSize: number;
  status: string;
  uploadedAt: string;
}

export function FileUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setUploadProgress(10);
    setError(null);

    try {
      setUploadProgress(30);
      const result: UploadResponse = await uploadFile(file);
      setUploadProgress(70);

      const newFile: UploadedFile = {
        fileId: result.data.fileId,
        fileName: result.data.fileName,
        fileSize: result.data.fileSize,
        status: result.data.status,
        uploadedAt: result.data.uploadedAt,
      };

      setUploadedFiles((prev) => [newFile, ...prev]);
      setUploadProgress(100);

      // Poll for status updates
      pollFileStatus(result.data.fileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, []);

  const pollFileStatus = useCallback(
    async (fileId: string) => {
      const maxAttempts = 20;
      let attempts = 0;

      const poll = async () => {
        if (attempts >= maxAttempts) {return;}
        attempts++;

        try {
          const statusRes = await getFileStatus(fileId);
          const newStatus = statusRes.data.status;

          setUploadedFiles((prev) =>
            prev.map((f) => (f.fileId === fileId ? { ...f, status: newStatus } : f))
          );

          if (newStatus !== 'COMPLETED' && newStatus !== 'FAILED') {
            setTimeout(poll, 3000);
          }
        } catch {
          // Silently stop polling on error
        }
      };

      setTimeout(poll, 3000);
    },
    []
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {return `${bytes} B`;}
    if (bytes < 1024 * 1024) {return `${(bytes / 1024).toFixed(1)} KB`;}
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'green';
      case 'PROCESSING':
        return 'blue';
      case 'FAILED':
        return 'red';
      case 'UPLOADED':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  return (
    <Stack gap="lg">
      <Title order={2}>Upload File</Title>
      <Text c="dimmed">
        Upload a Markdown or text file to process and index for full-text search.
      </Text>

      {/* Drop zone */}
      <Box
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-gray-4)'}`,
          borderRadius: 'var(--mantine-radius-md)',
          padding: '40px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: dragOver ? 'var(--mantine-color-blue-0)' : 'transparent',
          transition: 'all 150ms ease',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt,.markdown"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <Stack align="center" gap="xs">
          <Text size="xl" fw={500}>
            {dragOver ? 'Drop file here' : 'Drag & drop a file here'}
          </Text>
          <Text size="sm" c="dimmed">
            or click to browse — supports .md, .txt, .markdown
          </Text>
          <Button variant="light" mt="sm" disabled={uploading}>
            {uploading ? 'Uploading...' : 'Select File'}
          </Button>
        </Stack>
      </Box>

      {/* Upload progress */}
      {uploadProgress > 0 && (
        <Progress value={uploadProgress} animated size="sm" />
      )}

      {/* Error */}
      {error && (
        <Card withBorder bg="red.0" c="red.9">
          <Text fw={500}>Upload Error</Text>
          <Text size="sm">{error}</Text>
        </Card>
      )}

      {/* Uploaded files list */}
      {uploadedFiles.length > 0 && (
        <Stack gap="sm">
          <Title order={4}>Uploaded Files</Title>
          {uploadedFiles.map((file) => (
            <Card key={file.fileId} withBorder shadow="xs" padding="sm">
              <Group justify="space-between" wrap="wrap">
                <Stack gap={2}>
                  <Text fw={500}>{file.fileName}</Text>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">
                      ID: {file.fileId}
                    </Text>
                    <Text size="xs" c="dimmed">
                      •
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatFileSize(file.fileSize)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      •
                    </Text>
                    <Text size="xs" c="dimmed">
                      {new Date(file.uploadedAt).toLocaleString()}
                    </Text>
                  </Group>
                </Stack>
                <Group gap="xs">
                  <Badge color={getStatusColor(file.status)} variant="light">
                    {file.status}
                  </Badge>
                  {file.status !== 'COMPLETED' && file.status !== 'FAILED' && (
                    <Loader size="xs" />
                  )}
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
