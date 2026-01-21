# Reports API

A backend API for report management built with Node.js, TypeScript, and Express.

## Features

- JWT-based authentication with role-based authorization
- Report management with nested entries
- File upload with secure download tokens
- Flexible querying with views, filtering, and pagination
- Audit logging for all changes
- Input validation with Zod schemas
- Structured logging

## Project Structure

```
src/
├── database/
│   └── inMemoryDb.ts          # In-memory NoSQL-style data store
├── middleware/
│   ├── auth.middleware.ts     # JWT authentication
│   ├── authorization.middleware.ts  # Role-based access control
│   └── error.middleware.ts    # Centralized error handling
├── models/
│   ├── report.model.ts        # Report domain model & Zod schemas
│   └── user.model.ts          # User model & JWT payload
├── routes/
│   ├── auth.routes.ts         # Authentication endpoints
│   └── reports.routes.ts      # Report CRUD endpoints
├── services/
│   ├── report.service.ts      # Business logic layer
│   ├── fileStorage.service.ts # File storage abstraction
│   └── jobQueue.service.ts    # Async job processing
├── utils/
│   ├── logger.ts              # Winston logger configuration
│   ├── requestLogger.ts       # Request/response logging
│   └── errors.ts              # Error handling utilities
└── index.ts                   # Application entry point
```

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm run dev
```

Server runs on `http://localhost:3000`

## API Documentation

### Authentication

#### Generate Token
```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"john_editor\", \"role\": \"editor\"}"
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h",
  "user": {
    "userId": "user-1234567890",
    "username": "john_editor",
    "role": "editor"
  }
}
```

Save the token for subsequent requests:
```bash
set TOKEN=<your-token-here>
```

### Reports

#### 1. Create a Report (POST /reports)

```bash
curl -X POST http://localhost:3000/reports \
  -H "Authorization: Bearer %TOKEN%" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Q4 Sales Report\", \"ownerId\": \"user-123\", \"description\": \"Quarterly sales analysis\", \"status\": \"draft\", \"tags\": [\"sales\", \"q4\"]}"
```

Response (201 Created):
```json
{
  "id": "report-uuid",
  "title": "Q4 Sales Report",
  "status": "draft",
  "ownerId": "user-123",
  "description": "Quarterly sales analysis",
  "tags": ["sales", "q4"],
  "createdAt": "2026-01-21T10:00:00.000Z",
  "updatedAt": "2026-01-21T10:00:00.000Z",
  "version": 1,
  "entries": [],
  "comments": [],
  "attachments": [],
  "auditLog": [...]
}
```

#### 2. Get Report - Full View (GET /reports/:id)

```bash
curl http://localhost:3000/reports/<report-id> \
  -H "Authorization: Bearer %TOKEN%"
```

#### 3. Get Report - Summary View

```bash
curl "http://localhost:3000/reports/<report-id>?view=summary" \
  -H "Authorization: Bearer %TOKEN%"
```

Response:
```json
{
  "id": "report-uuid",
  "title": "Q4 Sales Report",
  "status": "draft",
  "ownerId": "user-123",
  "createdAt": "2026-01-21T10:00:00.000Z",
  "updatedAt": "2026-01-21T10:00:00.000Z",
  "totalEntries": 0,
  "completedEntries": 0,
  "recentActivityCount": 0,
  "highPriorityCount": 0
}
```

#### 4. Get Report with Specific Fields

```bash
curl "http://localhost:3000/reports/<report-id>?include=entries,metrics,tags" \
  -H "Authorization: Bearer %TOKEN%"
```

#### 5. Get Report with Paginated Entries

```bash
curl "http://localhost:3000/reports/<report-id>?page=0&size=10&sortBy=priority&filterPriority=high" \
  -H "Authorization: Bearer %TOKEN%"
```

Response:
```json
{
  "id": "report-uuid",
  "entries": {
    "data": [...],
    "pagination": {
      "page": 0,
      "size": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

#### 6. Update Report (PUT /reports/:id)

Basic update:
```bash
curl -X PUT http://localhost:3000/reports/<report-id> \
  -H "Authorization: Bearer %TOKEN%" \
  -H "Content-Type: application/json" \
  -d "{\"status\": \"in_progress\", \"tags\": [\"sales\", \"q4\", \"updated\"]}"
```

With optimistic concurrency control:
```bash
curl -X PUT http://localhost:3000/reports/<report-id> \
  -H "Authorization: Bearer %TOKEN%" \
  -H "If-Match: 1" \
  -H "Content-Type: application/json" \
  -d "{\"status\": \"in_progress\"}"
```

With idempotency:
```bash
curl -X PUT http://localhost:3000/reports/<report-id> \
  -H "Authorization: Bearer %TOKEN%" \
  -H "Idempotency-Key: unique-key-123" \
  -H "Content-Type: application/json" \
  -d "{\"status\": \"in_progress\"}"
```

Forcing update on finalized report (editor only):
```bash
curl -X PUT http://localhost:3000/reports/<report-id> \
  -H "Authorization: Bearer %TOKEN%" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Updated Title\", \"force\": true}"
```

#### 7. Update Report with Entries

```bash
curl -X PUT http://localhost:3000/reports/<report-id> \
  -H "Authorization: Bearer %TOKEN%" \
  -H "Content-Type: application/json" \
  -d "{\"entries\": [{\"id\": \"entry-1\", \"priority\": \"high\", \"timestamp\": \"2026-01-21T10:00:00.000Z\", \"value\": {\"amount\": 1000}, \"status\": \"active\", \"notes\": \"Important entry\"}]}"
```

#### 8. Upload Attachment (POST /reports/:id/attachment)

```bash
curl -X POST http://localhost:3000/reports/<report-id>/attachment \
  -H "Authorization: Bearer %TOKEN%" \
  -F "file=@path/to/your/file.pdf"
```

Response (201 Created):
```json
{
  "attachment": {
    "id": "attachment-uuid",
    "filename": "storage-filename.pdf",
    "originalName": "file.pdf",
    "mimeType": "application/pdf",
    "size": 12345,
    "uploadedAt": "2026-01-21T10:00:00.000Z",
    "uploadedBy": "user-123",
    "storageKey": "storage-key",
    "downloadToken": "secure-token",
    "tokenExpiresAt": "2026-01-21T11:00:00.000Z"
  },
  "downloadUrl": "/reports/<report-id>/attachments/<attachment-id>/download?token=secure-token"
}
```

#### 9. Download Attachment

```bash
curl "http://localhost:3000/reports/<report-id>/attachments/<attachment-id>/download?token=<download-token>" \
  --output downloaded-file.pdf
```

### Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "requestId": "uuid"
  }
}
```

Common error codes:
- `UNAUTHORIZED` (401): Missing or invalid authentication
- `FORBIDDEN` (403): Insufficient permissions
- `REPORT_NOT_FOUND` (404): Report does not exist
- `VALIDATION_ERROR` (400): Invalid input data
- `VERSION_CONFLICT` (409): Concurrent modification detected
- `DUPLICATE_REPORT` (409): Report with same title and owner exists
- `FORCE_REQUIRED` (400): Finalized report edit requires force=true

## Business Rules

### FINALIZED Status Protection

Reports with `finalized` status cannot be edited unless:
1. The user has the `editor` role
2. The request includes `"force": true` in the body

All forced edits are logged in the audit trail.

Example:
```bash
# This will fail without force=true
curl -X PUT http://localhost:3000/reports/<finalized-report-id> \
  -H "Authorization: Bearer %TOKEN%" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"New Title\"}"

# This will succeed
curl -X PUT http://localhost:3000/reports/<finalized-report-id> \
  -H "Authorization: Bearer %TOKEN%" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"New Title\", \"force\": true}"
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| JWT_SECRET | Secret key for JWT signing | (change in production) |
| NODE_ENV | Environment | development |
| UPLOAD_DIR | Directory for file uploads | ./uploads |
| MAX_FILE_SIZE | Maximum file size in bytes | 5242880 (5MB) |

## License

MIT
