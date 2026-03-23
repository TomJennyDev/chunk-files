const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface UploadResponse {
  statusCode: number;
  message: string;
  data: {
    fileId: string;
    fileName: string;
    fileSize: number;
    s3Key: string;
    status: string;
    uploadedAt: string;
  };
}

export interface SearchResult {
  fileId: string;
  chunkIndex: number;
  content: string;
  fileName: string;
  startByte?: number;
  endByte?: number;
  heading?: { text: string; level: number; id: string };
  score?: number;
}

export interface SearchResponse {
  statusCode: number;
  data: {
    total: number;
    took: number;
    page: number;
    results: SearchResult[];
  };
}

export interface FileStatusResponse {
  statusCode: number;
  data: {
    fileId: string;
    fileName: string;
    status: string;
    uploadedAt: string;
  };
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/files/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `Upload failed (${res.status})`);
  }

  return res.json();
}

export async function searchFiles(params: {
  text: string;
  fileId?: string;
  page?: number;
  size?: number;
}): Promise<SearchResponse> {
  const query = new URLSearchParams();
  query.set('text', params.text);
  if (params.fileId) {
    query.set('fileId', params.fileId);
  }
  if (params.page) {
    query.set('page', String(params.page));
  }
  if (params.size) {
    query.set('size', String(params.size));
  }

  const res = await fetch(`${API_BASE}/search?${query}`);

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `Search failed (${res.status})`);
  }

  return res.json();
}

export async function getFileStatus(fileId: string): Promise<FileStatusResponse> {
  const res = await fetch(`${API_BASE}/files/${fileId}/status`);

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `Status check failed (${res.status})`);
  }

  return res.json();
}

/**
 * Download the original file content from S3 via the backend.
 * @param fileId - The file UUID
 * @param fileName - Optional fileName for s3Key reconstruction fallback
 */
export async function getFileContent(fileId: string, fileName?: string): Promise<string> {
  const params = new URLSearchParams();
  if (fileName) {
    params.set('fileName', fileName);
  }
  const qs = params.toString();
  const url = `${API_BASE}/files/${fileId}/download${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `File download failed (${res.status})`);
  }

  return res.text();
}
