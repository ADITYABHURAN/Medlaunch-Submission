# Reports API

A production-ready backend API for report management with role-based access control, file uploads, and audit logging.

## Features

- 🔐 JWT-based authentication with role-based authorization (Reader/Editor)
- 📊 Report management with nested entries, comments, and attachments
- 📎 Secure file uploads with time-limited download tokens
- 🔍 Flexible querying with views and filtering
- 📝 Complete audit trail for all changes
- 🛡️ Input validation with Zod schemas
- ⚡ Concurrency control with optimistic locking

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm run dev
```

Server runs on `http://localhost:3000`

### 3. Verify Server is Running
```bash
curl http://localhost:3000/health
```

## Authentication

### Get a Test Token

Generate tokens for testing (no registration required):

```bash
# Editor role (can create/update reports)
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"editor_user\", \"role\": \"editor\"}"

# Reader role (can only view reports)
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"reader_user\", \"role\": \"reader\"}"
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h",
  "user": {
    "userId": "user-1234567890",
    "username": "editor_user",
    "role": "editor"
  }
}
```



**Save your token:**
```bash
# Windows PowerShell
$TOKEN = "your-token-here"

# Linux/Mac
export TOKEN="your-token-here"
```

## API Endpoints

### 1. Create a Report
```bash
curl -X POST http://localhost:3000/reports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Q4 Sales Report\", \"ownerId\": \"user-123\", \"description\": \"Quarterly analysis\", \"status\": \"draft\"}"
```

### 2. Get a Report
```bash
curl http://localhost:3000/reports/{report-id} \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Update a Report
```bash
curl -X PUT http://localhost:3000/reports/{report-id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"status\": \"in_progress\"}"
```

### 4. Upload an Attachment
```bash
curl -X POST http://localhost:3000/reports/{report-id}/attachment \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@document.pdf"
```

### 5. Download an Attachment
```bash
curl "http://localhost:3000/reports/{report-id}/attachments/{attachment-id}/download?token={download-token}" \
  --output file.pdf
```

> 💡 **Note:** Download tokens expire after 60 minutes and are returned when uploading attachments.

## Roles & Permissions

| Role | Can View Reports | Can Create Reports | Can Update Reports | Can Upload Files |
|------|-----------------|-------------------|-------------------|------------------|
| **Reader** | ✅ | ❌ | ❌ | ❌ |
| **Editor** | ✅ | ✅ | ✅ | ✅ |

### Special Rules

- **Finalized Reports**: Only editors can modify finalized reports, and must include `"force": true` in the request
- **Download Tokens**: Valid for 60 minutes from creation, can be used by anyone with the token

## Custom Business Rule: Finalized Report Protection

Reports with `status: "finalized"` are protected from modification to ensure data integrity. 

**To edit a finalized report:**
1. Must have `editor` role
2. Must include `"force": true` in the update request
3. Edit is logged in the audit trail with a warning

**Example:**
```bash
curl -X PUT http://localhost:3000/reports/{report-id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Updated Title\", \"force\": true}"
```

## Report Fields

### Required Fields
- `title` (string, 1-200 characters)
- `ownerId` (string)

### Optional Fields
- `status` (enum: draft | in_progress | under_review | finalized | archived) - defaults to "draft"
- `description` (string)
- `metadata` (object)
- `tags` (string array)

### Entry Fields (nested in reports)
- `id` (string, required)
- `priority` (enum: low | medium | high | critical, required)
- `timestamp` (ISO datetime, required)
- `value` (any, required)
- `status` (enum: pending | active | completed | cancelled, required)
- `notes` (string, optional)

## Environment Variables

Create a `.env` file (optional):

```env
PORT=3000
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
```

## Project Structure

```
src/
├── database/          # In-memory data store
├── middleware/        # Auth, authorization, error handling
├── models/           # Data models & validation schemas
├── routes/           # API route definitions
├── services/         # Business logic & file storage
└── utils/            # Logging & error utilities
```

## Documentation

For more detailed information, see:
- **design.md** - Architecture, data models, and design decisions
- **API-EXAMPLES.md** - Complete API examples with sample payloads
- **PRODUCTION-ROADMAP.md** - Future enhancements and production considerations

## Testing

Use the included PowerShell test scripts:

```bash
# Test all API endpoints
.\test-api.ps1

# Simple health check
.\test-simple.ps1
```

## License

MIT
