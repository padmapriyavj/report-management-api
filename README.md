# Report Management API

A backend API service for managing reports with nested entries, comments, and file attachments. Built with Node.js, TypeScript, and Express.

## Stack

- Node.js + TypeScript (strict mode)
- Express.js for HTTP routing
- Zod for runtime validation and type generation
- JWT for authentication
- Pino for structured JSON logging
- Multer for file uploads
- In-memory Map-based data store

## Setup

```bash
git clone <repo-url>
cd report-management-api
npm install
```

Create a `.env` file (optional — defaults are provided for development):

```
PORT=3000
JWT_SECRET=your-secret-here
DOWNLOAD_TOKEN_TTL=3600
LOG_LEVEL=info
```

Start the server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

## Authentication

The API uses JWT bearer tokens with three roles: `reader`, `editor`, and `admin`.

Generate a test token:

```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-1", "role": "editor"}'
```

Include the token in subsequent requests:

```
Authorization: Bearer <token>
```

### Role Permissions

| Endpoint | reader | editor | admin |
|----------|--------|--------|-------|
| GET /reports/:id | Yes | Yes | Yes |
| POST /reports | No | Yes | Yes |
| PUT /reports/:id | No | Yes | Yes |
| POST /reports/:id/attachment | No | Yes | Yes |
| GET .../download | Yes | Yes | Yes |

## API Endpoints

### POST /reports

Create a new report. Returns 201 with the full report and a Location header.

```bash
curl -X POST http://localhost:3000/reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "Q1 Compliance Report",
    "description": "Quarterly review of compliance metrics",
    "priority": "high",
    "tags": ["compliance", "q1"],
    "entries": [
      {
        "content": "Initial finding from audit",
        "amount": 1500,
        "status": "pending"
      }
    ],
    "metadata": {
      "department": "legal",
      "quarter": "Q1"
    }
  }'
```

Required fields: `title` (3-200 characters). All other fields are optional. The server generates `id`, `businessKey` (format RPT-YYYY-NNNN), `status` (always starts as "draft"), and `version` (starts at 1).

### GET /reports/:id

Retrieve a report with computed metrics, nested collections, and pagination.

```bash
# Full view (default)
curl http://localhost:3000/reports/<id> \
  -H "Authorization: Bearer <token>"

# Summary view (flat, no nested arrays)
curl "http://localhost:3000/reports/<id>?view=summary" \
  -H "Authorization: Bearer <token>"

# Selective includes
curl "http://localhost:3000/reports/<id>?include=entries,metrics" \
  -H "Authorization: Bearer <token>"

# Pagination and filtering
curl "http://localhost:3000/reports/<id>?page=1&size=10&sortBy=priority&sortOrder=desc&filterStatus=pending" \
  -H "Authorization: Bearer <token>"
```

Query parameters:

| Parameter | Default | Options |
|-----------|---------|---------|
| view | full | full, summary |
| include | all | entries, comments, metrics, attachments |
| page | 1 | Any positive integer |
| size | 20 | 1-100 |
| sortBy | createdAt | createdAt, priority, amount, status |
| sortOrder | desc | asc, desc |
| filterPriority | - | low, medium, high, critical |
| filterStatus | - | pending, completed, cancelled |

### PUT /reports/:id

Update a report. Requires the `If-Match` header with the current version number for optimistic concurrency control.

```bash
curl -X PUT http://localhost:3000/reports/<id> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -H "If-Match: 1" \
  -d '{
    "title": "Updated Report Title",
    "priority": "critical"
  }'
```

Supports partial updates. Only include the fields you want to change. Metadata merges with existing values. Entries are fully replaced if provided.

Optional `Idempotency-Key` header prevents duplicate mutations from network retries:

```bash
curl -X PUT http://localhost:3000/reports/<id> \
  -H "Authorization: Bearer <token>" \
  -H "If-Match: 1" \
  -H "Idempotency-Key: unique-client-key-123" \
  -d '{"title": "Safe Retry"}'
```

### POST /reports/:id/attachment

Upload a file attached to a report.

```bash
curl -X POST http://localhost:3000/reports/<id>/attachment \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/document.pdf"
```

Constraints: max 10 MB, max 10 attachments per report. Allowed types: PDF, PNG, JPEG, CSV, XLSX.

The response includes a `downloadToken` and `tokenExpiresAt` (1 hour TTL).

### GET /reports/:id/attachments/:attachmentId/download

Download an attachment using the signed token from the upload response.

```bash
curl "http://localhost:3000/reports/<id>/attachments/<attachmentId>/download?token=<downloadToken>" \
  -H "Authorization: Bearer <token>" \
  --output document.pdf
```

Expired tokens return 410 Gone. Invalid tokens return 403 Forbidden.

## Custom Business Rule: Status Transition Gate

Reports follow a controlled status workflow with role-based restrictions.

Allowed transitions:

| From | To | Who | Condition |
|------|----|-----|-----------|
| draft | in_review | editor, admin | Report must have at least one entry |
| in_review | draft | editor, admin | - |
| in_review | approved | admin only | - |
| approved | archived | editor, admin | - |

Archived reports are immutable. Any update to an archived report returns 422.

This rule models a realistic approval workflow found in healthcare and regulatory domains. It prevents unauthorized approvals, ensures reports have substance before review, and creates an immutable archive state.

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "traceId": "uuid-for-debugging",
    "details": [
      {
        "field": "title",
        "message": "Title must be at least 3 characters",
        "code": "FIELD_INVALID"
      }
    ]
  }
}
```

Error codes: VALIDATION_ERROR (400), UNAUTHORIZED (401), FORBIDDEN (403), NOT_FOUND (404), CONFLICT (409), GONE (410), PAYLOAD_TOO_LARGE (413), INVALID_TRANSITION (422), REPORT_ARCHIVED (422), PRECONDITION_REQUIRED (428), INTERNAL_ERROR (500).

## Project Structure

```
src/
  config/           Environment config and constants
  middleware/       Auth, logging, error handling, file upload
  routes/           Express route definitions
  controllers/      Request/response handling
  services/         Business logic and orchestration
  repositories/     In-memory data store
  models/           Zod schemas and TypeScript types
  queue/            Async job queue with retry and DLQ
  storage/          File storage abstraction
  utils/            Sanitization, token helpers
  __tests__/        Unit and integration tests
```

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

The test suite covers validation schemas, business rules, computed metrics, and integration tests for all four endpoints.