# API Reference

This document provides a comprehensive reference for the File Processing System API, powered by NestJS. Base path for all endpoints: `/api`. Local default: `http://localhost:3000/api`.

## Authentication
*(If applicable, explain JWT/Bearer token logic here. Currently, default endpoints may be open for local testing.)*

---

## Endpoints

### 1. Upload File
Uploads a file, stores it in S3, and queues it for Lambda processing.

**URL:** `/files/upload`  
**Method:** `POST`  
**Content-Type:** `multipart/form-data`

**Request Body:**
| Field | Type | Description | Required |
| --- | --- | --- | --- |
| `file` | File | The file to upload (e.g., `.md`, `.txt`, `.pdf`) | Yes |

**Success Response (201 Created):**
```json
{
  "fileId": "uuid-1234-5678",
  "name": "sample.md",
  "status": "processing",
  "message": "File uploaded successfully and queued for processing"
}
```

---

### 2. Get File Status
Retrieves the processing status of a previously uploaded file.

**URL:** `/files/:fileId/status`  
**Method:** `GET`

**URL Parameters:**
| Parameter | Type | Description |
| --- | --- | --- |
| `fileId` | String | The UUID of the file returned upon upload |

**Success Response (200 OK):**
```json
{
  "fileId": "uuid-1234-5678",
  "status": "completed",
  "updatedAt": "2026-03-15T12:00:00Z"
}
```
*Possible Statuses: `pending`, `processing`, `completed`, `failed`*

---

### 3. Search Files
Search through the indexed chunks in Elasticsearch.

**URL:** `/files/search`  
**Method:** `GET`

**Query Parameters:**
| Parameter | Type | Description | Required | Default |
| --- | --- | --- | --- | --- |
| `q` | String | Search query text | Yes | |
| `page` | Integer | Page number (1-indexed) | No | 1 |
| `limit` | Integer| Number of results per page | No | 10 |

**Success Response (200 OK):**
```json
{
  "total": 12,
  "page": 1,
  "limit": 10,
  "results": [
    {
      "fileId": "uuid-1234-5678",
      "chunkId": "chunk-1",
      "text": "...matched text snippet...",
      "score": 1.45,
      "metadata": {
        "fileName": "sample.md"
      }
    }
  ]
}
```

---

### 4. Download Original File
Downloads the original file stored in S3.

**URL:** `/files/:fileId/download`  
**Method:** `GET`

**URL Parameters:**
| Parameter | Type | Description |
| --- | --- | --- |
| `fileId` | String | The UUID of the file |

**Response:**
Returns the raw file stream as an attachment (e.g., `application/octet-stream`).

---

### 5. Health Check
Verifies that the API and its direct dependencies are running.

**URL:** `/health`  
**Method:** `GET`

**Success Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-03-15T12:05:00Z"
}
```

---

## WebSocket Events (Optional/Future)
If the project utilizes Socket.io for real-time status updates:
- **Event `file.status.update`**: Payload contains `{ fileId, status }`.
