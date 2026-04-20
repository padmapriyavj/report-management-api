# PRD – Backend API Service | MedLaunch Concepts

## PRODUCT REQUIREMENTS DOCUMENT

---

### Backend API Design & Implementation — Report Management Service

| **Field** | **Details** |
| --- | --- |
| Role | Backend Engineer – MedLaunch Concepts |
| Stack | Node.js + TypeScript (NoSQL / In-Memory) |
| Version | 1.0 |
| Date | April 20, 2026 |
| Status | Ready for Implementation |
| Timeline | 5 calendar days |

# 1. Executive Summary

This PRD defines the full scope, requirements, data models, and implementation plan for a production-quality backend API service built with Node.js and TypeScript. The service manages Reports as the core domain resource, exposing CRUD operations, file attachments, role-based access control, and asynchronous processing. The architecture uses an in-memory NoSQL-style document store, making it self-contained with no external database dependency.

The project serves as the technical assessment for the Backend Engineer role at MedLaunch Concepts. Every requirement extracted from the challenge specification is captured below with acceptance criteria, and a phased implementation plan provides clear milestones for delivery within the 5-day window.

# 2. Objectives & Success Criteria

## 2.1 Primary Objectives

- Implement four core API endpoints (GET, PUT, POST, file upload) with full production-quality semantics.

- Design a document-oriented data model with at least 10 fields and nested collections.

- Enforce authentication (JWT), role-based authorization (reader vs. editor), and input validation.

- Demonstrate concurrency control, idempotency, audit logging, and asynchronous side-effect handling.

- Deliver clean, modular, well-documented TypeScript code with meaningful commit history.

## 2.2 Success Criteria

| **#** | **Criterion** | **Measurement** |
| --- | --- | --- |
| SC-1 | All 4 endpoints return correct HTTP status codes and response shapes | Automated test suite passes |
| SC-2 | JWT auth rejects unauthenticated and unauthorized requests | 401/403 returned correctly |
| SC-3 | PUT is idempotent; optimistic concurrency prevents lost updates | Repeat requests produce same result; version conflict returns 409 |
| SC-4 | File upload enforces type/size limits and serves secure downloads | Invalid files rejected; download tokens expire |
| SC-5 | Async side effects retry on failure with dead-letter fallback | Failed jobs appear in DLQ after max retries |
| SC-6 | Structured logging includes request/trace IDs on every request | Log output is parseable JSON with traceId |
| SC-7 | Custom business rule is enforced and documented | Rule triggers correct validation errors |
| SC-8 | Design write-up covers all required sections with justified decisions | design.md complete and reviewed |

# 3. Domain Model & Data Schema

## 3.1 Core Resource: Report

The Report is the central aggregate, containing nested Entries, Comments, Attachments, and computed Metrics. The schema uses a document-oriented (NoSQL) design stored in-memory via a Map-based data store.

### 3.1.1 Report Document Schema

| **Field** | **Type** | **Required** | **Description** |
| --- | --- | --- | --- |
| id | string (UUID v4) | Auto | Server-generated unique identifier |
| businessKey | string | Yes | Human-readable unique key (e.g., RPT-2026-0001). Enforced unique. |
| title | string | Yes | Report title (3–200 chars, sanitized) |
| description | string | No | Detailed description (max 5000 chars) |
| status | enum | Yes | draft │ in_review │ approved │ archived |
| priority | enum | No | low │ medium │ high │ critical (default: medium) |
| category | string | No | Freeform category tag |
| tags | string[] | No | Array of classification tags |
| createdBy | string | Auto | User ID of creator (from JWT) |
| createdAt | ISO 8601 | Auto | Creation timestamp |
| updatedAt | ISO 8601 | Auto | Last modification timestamp |
| updatedBy | string | Auto | User ID of last modifier |
| version | integer | Auto | Optimistic concurrency version, starts at 1 |
| entries | Entry[] | Auto | Nested collection of report entries |
| comments | Comment[] | Auto | Discussion thread on the report |
| attachments | Attachment[] | Auto | File references linked to this report |
| metadata | object | No | Extensible key-value pairs |

### 3.1.2 Entry Sub-document

| **Field** | **Type** | **Required** | **Description** |
| --- | --- | --- | --- |
| id | string (UUID v4) | Auto | Entry identifier |
| content | string | Yes | Entry body text (max 10,000 chars) |
| amount | number | No | Numeric value for aggregation |
| priority | enum | No | low │ medium │ high │ critical |
| status | enum | Yes | pending │ completed │ cancelled |
| createdAt | ISO 8601 | Auto | Entry creation timestamp |
| createdBy | string | Auto | Author user ID |

### 3.1.3 Comment Sub-document

| **Field** | **Type** | **Required** | **Description** |
| --- | --- | --- | --- |
| id | string (UUID v4) | Auto | Comment identifier |
| text | string | Yes | Comment body |
| authorId | string | Auto | Commenter user ID |
| createdAt | ISO 8601 | Auto | Comment timestamp |

### 3.1.4 Attachment Sub-document

| **Field** | **Type** | **Required** | **Description** |
| --- | --- | --- | --- |
| id | string (UUID v4) | Auto | Attachment identifier |
| filename | string | Yes | Original filename (sanitized) |
| mimeType | string | Yes | Validated MIME type |
| sizeBytes | number | Yes | File size in bytes |
| storagePath | string | Auto | Internal path in abstracted store |
| uploadedBy | string | Auto | Uploader user ID |
| uploadedAt | ISO 8601 | Auto | Upload timestamp |
| downloadToken | string | Auto | Signed, expiring token for safe access |
| tokenExpiresAt | ISO 8601 | Auto | Token expiry (default: 1 hour) |

## 3.2 Computed / Aggregated Fields (returned in GET)

| **Field** | **Type** | **Derivation** |
| --- | --- | --- |
| totalEntries | number | Count of entries array |
| totalAmount | number | Sum of all entry.amount values |
| completionRate | number | Percentage of entries with status=completed |
| derivedStatus | string | Auto-calculated: if completionRate=100% → complete, >50% → in_progress, else pending |
| trendIndicator | string | up │ down │ stable – based on recent entry creation velocity |
| highPriorityCount | number | Count of entries where priority is high or critical |
| commentCount | number | Count of comments array |
| attachmentCount | number | Count of attachments array |
| lastActivityAt | ISO 8601 | Most recent timestamp across entries, comments, attachments |

# 4. Authentication & Authorization

## 4.1 Authentication Model

The service uses JWT (JSON Web Token) bearer authentication. Tokens are passed in the Authorization header as "Bearer <token>". For the assessment, pre-signed test tokens are provided via a /auth/token utility endpoint or generated using a shared secret. Tokens include the user ID, role, and expiration (1-hour default).

## 4.2 Role Definitions & Permissions

| **Permission** | **reader** | **editor** | **admin** | **Details** | **HTTP Code** |
| --- | --- | --- | --- | --- | --- |
| GET /reports/:id | Yes | Yes | Yes | All authenticated users can read | – |
| POST /reports | No | Yes | Yes | Only editors+ can create | 403 |
| PUT /reports/:id | No | Yes* | Yes | *Custom business rule may restrict | 403 |
| POST .../attachment | No | Yes | Yes | Only editors+ can upload | 403 |
| GET .../download | Yes | Yes | Yes | Valid token required | 403/410 |
| DELETE (future) | No | No | Yes | Reserved for admin role | 403 |

## 4.3 Security Assumptions

- All traffic is assumed over HTTPS/TLS in production (simulated in assessment).

- JWT secret is loaded from environment variable JWT_SECRET, never hardcoded.

- Tokens expire after 1 hour; refresh flow is out of scope but noted in design.md.

- Input sanitization strips HTML/script tags to prevent XSS in stored content.

- Rate limiting middleware (e.g., express-rate-limit) is recommended for production.

# 5. API Endpoints – Detailed Specifications

## 5.1 GET /reports/:id

**Purpose:** Retrieve a single report with nested collections, computed metrics, and support for multiple output shapes.

### 5.1.1 Query Parameters

| **Parameter** | **Type** | **Default** | **Description** |
| --- | --- | --- | --- |
| view | string | full | "full" (hierarchical JSON) or "summary" (compact flattened) |
| include | string | all | Comma-separated: entries, comments, metrics, attachments |
| page | integer | 1 | Page number for entries pagination |
| size | integer | 20 | Items per page for entries (max 100) |
| sortBy | string | createdAt | Sort entries by: createdAt, priority, amount, status |
| sortOrder | string | desc | "asc" or "desc" |
| filterPriority | string | – | Filter entries by priority: low, medium, high, critical |
| filterStatus | string | – | Filter entries by status: pending, completed, cancelled |

### 5.1.2 Response Shapes

**Full View (default): **Returns the complete Report document with all nested arrays, computed metrics, and pagination metadata for entries.

**Summary View (?view=summary): **Returns a flat object with id, businessKey, title, status, derivedStatus, totalEntries, totalAmount, completionRate, trendIndicator, lastActivityAt. No nested arrays.

### 5.1.3 Acceptance Criteria

- Returns 200 with correct shape based on view parameter.

- Returns 404 with structured error if report ID does not exist.

- Pagination metadata includes: page, size, totalItems, totalPages, hasNext, hasPrev.

- Entries are filtered and sorted per query params before pagination.

- Omitted include fields are excluded from response body entirely.

- Returns 401 if no/invalid JWT; 403 if role lacks permission.

## 5.2 POST /reports

**Purpose:** Create a new Report resource with server-generated ID, input validation, uniqueness enforcement, and async side-effect triggering.

### 5.2.1 Request Body

| **Field** | **Type** | **Required** | **Validation** |
| --- | --- | --- | --- |
| title | string | Yes | 3–200 chars; HTML stripped |
| description | string | No | Max 5000 chars; HTML stripped |
| priority | enum | No | Must be low│medium│high│critical; default medium |
| category | string | No | Max 100 chars |
| tags | string[] | No | Max 20 tags, each max 50 chars |
| entries | Entry[] | No | Initial entries; each validated per Entry schema |
| metadata | object | No | Max 10 keys, values must be strings/numbers |

### 5.2.2 Server-Side Behavior

- Generate UUID v4 as the report id.

- Generate businessKey in format RPT-YYYY-NNNN (auto-incrementing sequence). Reject with 409 if duplicate.

- Set status to "draft", version to 1, populate createdBy/createdAt from JWT and system clock.

- Sanitize all string inputs (strip HTML tags, trim whitespace).

- Persist report to in-memory store.

- Enqueue asynchronous side effect (report-created notification) to the job queue.

- Return 201 Created with Location header pointing to /reports/:id and the full report in the body.

### 5.2.3 Async Side Effect: Job Queue

On successful creation, a background job is enqueued representing a notification or cache-invalidation task. The queue implementation is in-memory with the following failure-handling strategy:

- Retry with exponential backoff: 3 attempts at 1s, 2s, 4s intervals.

- After max retries, the job is moved to a dead-letter queue (DLQ) with error context.

- A compensating marker is set on the report (e.g., sideEffectStatus: "failed") so operators can identify reports with failed notifications.

- The DLQ is inspectable via structured logs.

### 5.2.4 Acceptance Criteria

- Returns 201 with Location header and full report body.

- Returns 400 with structured field-level errors for invalid input.

- Returns 409 if businessKey collision occurs.

- Returns 401/403 for auth failures.

- Async job executes after response is sent; failures do not block the API response.

## 5.3 PUT /reports/:id

**Purpose:** Update an existing report with full or partial semantics, idempotency guarantees, optimistic concurrency control, and audit logging.

### 5.3.1 Request Headers & Body

| **Field/Header** | **Type** | **Required** | **Description** |
| --- | --- | --- | --- |
| If-Match (header) | string | Yes | Must contain the current version number for optimistic locking |
| Idempotency-Key (header) | string | No | Client-supplied key; if repeated, returns cached response |
| title | string | No | Updated title (same validation as POST) |
| description | string | No | Updated description |
| status | enum | No | Updated status (transition rules apply) |
| priority | enum | No | Updated priority |
| entries | Entry[] | No | Replace entries array (full replacement if provided) |
| metadata | object | No | Merge with existing metadata |

### 5.3.2 Concurrency Control

Uses optimistic concurrency via a version field. The client must send the current version in the If-Match header. On update, the server checks the version: if it matches, the update proceeds and version increments; if not, the server returns 409 Conflict with the current version in the response so the client can retry.

### 5.3.3 Idempotency

If the client includes an Idempotency-Key header, the server caches the response keyed by that value (TTL: 24 hours). Repeat requests with the same key return the cached response without re-executing the update. This prevents duplicate mutations from network retries.

### 5.3.4 Audit Trail

Every update generates an audit log entry stored in-memory, capturing:

- Timestamp of the change.

- User ID (from JWT) who made the change.

- Before-snapshot (previous field values for changed fields).

- After-snapshot (new field values).

- The specific fields that were modified.

### 5.3.5 Acceptance Criteria

- Returns 200 with updated report including incremented version.

- Returns 404 if report does not exist.

- Returns 409 if If-Match version does not match (concurrency conflict).

- Returns 400 with field-level errors for invalid input.

- Repeated requests with same Idempotency-Key return identical responses.

- Audit log entry is created for every successful update.

- Custom business rule is enforced (see Section 7).

## 5.4 POST /reports/:id/attachment

**Purpose:** Upload a file tied to an existing report, with validation, abstracted storage, and secure download access.

### 5.4.1 Request

Multipart form-data with a single file field. Content-Type must be multipart/form-data.

### 5.4.2 Validation & Constraints

| **Constraint** | **Value** |
| --- | --- |
| Max file size | 10 MB |
| Allowed MIME types | application/pdf, image/png, image/jpeg, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet |
| Max attachments per report | 10 |
| Filename sanitization | Strip path separators, null bytes; limit to 255 chars |

### 5.4.3 Storage Layer

File storage is abstracted behind a FileStorageService interface with two implementations: LocalDiskStorage (default, writes to ./uploads/) and a described-but-not-implemented CloudObjectStorage (S3-compatible). The interface defines put(key, buffer, metadata), get(key), delete(key), and generateSignedUrl(key, ttl). This allows swapping storage backends without changing endpoint logic.

### 5.4.4 Secure Download Access

Attachments are not served directly. Instead, a download endpoint (GET /reports/:id/attachments/:attachmentId/download) verifies a signed download token passed as a query parameter. Tokens are generated using HMAC-SHA256 with a configurable TTL (default: 1 hour). Expired or invalid tokens return 410 Gone or 403 Forbidden respectively.

### 5.4.5 Virus Scanning (Production Consideration)

In production, uploaded files would be routed through a scanning pipeline before being marked as available. The approach: upload to a quarantine bucket, trigger a scanning job (e.g., ClamAV or a cloud-native service like AWS GuardDuty/S3 Malware Protection), and only move the file to the active bucket upon a clean scan. The attachment record would carry a scanStatus field (pending, clean, infected) and downloads would be blocked while scanStatus is not clean.

### 5.4.6 Acceptance Criteria

- Returns 201 with attachment metadata including download token.

- Returns 400 if file type or size is invalid.

- Returns 404 if parent report does not exist.

- Returns 413 if file exceeds size limit.

- Download endpoint returns file content with correct Content-Type for valid tokens.

- Download endpoint returns 410 for expired tokens.

# 6. Error Handling & Response Schema

## 6.1 Consistent Error Response Format

All error responses follow a uniform JSON structure to enable predictable client-side handling:

{ "error": { "code": "VALIDATION_ERROR", "message": "...", "traceId": "...", "details": [ { "field": "title", "message": "...", "code": "FIELD_REQUIRED" } ] } }

## 6.2 Error Code Catalog

| **HTTP** | **Code** | **Scenario** | **Details** |
| --- | --- | --- | --- |
| 400 | VALIDATION_ERROR | Invalid input fields | Includes field-level details array |
| 401 | UNAUTHORIZED | Missing or invalid JWT | Token expired, malformed, or absent |
| 403 | FORBIDDEN | Role lacks permission | Includes required role |
| 404 | NOT_FOUND | Resource does not exist | Includes resource type and ID |
| 409 | CONFLICT | Version mismatch or duplicate key | Includes current version or conflicting key |
| 413 | PAYLOAD_TOO_LARGE | File exceeds size limit | Includes max allowed size |
| 410 | GONE | Download token expired | Client must request new token |
| 429 | RATE_LIMITED | Too many requests | Includes retry-after header |
| 500 | INTERNAL_ERROR | Unexpected server error | traceId for support correlation |

# 7. Custom Business Rule

## 7.1 Rule: Status Transition Gate with Role Escalation

**Statement: **Reports in "in_review" status can only be transitioned to "approved" by a user with the admin role. Editors may move reports from "draft" to "in_review" or from "approved" to "archived", but cannot approve reports. Additionally, a report cannot be moved to "in_review" unless it contains at least one entry.

## 7.2 Status Transition Matrix

| **From ↓ / To →** | **draft** | **in_review** | **approved** | **archived** |
| --- | --- | --- | --- | --- |
| draft | – | editor+ (if entries ≥ 1) | – | – |
| in_review | editor+ | – | admin only | – |
| approved | – | – | – | editor+ |
| archived | – | – | – | – |

## 7.3 Impact on API Behavior

- PUT /reports/:id validates status transitions against the matrix. Invalid transitions return 403 (wrong role) or 422 (invalid transition).

- The entries ≥ 1 precondition prevents empty reports from entering review.

- Archived reports are immutable – any PUT to an archived report returns 422 with code REPORT_ARCHIVED.

- Audit logs capture attempted invalid transitions for security monitoring.

## 7.4 Justification

This rule models a realistic approval workflow found in healthcare/regulatory domains (relevant to MedLaunch). It prevents unauthorized approvals, ensures reports have substance before review, and creates an immutable archive. The rule impacts validation logic, authorization checks, and the data model (status field with constrained transitions), demonstrating non-trivial business logic integration.

# 8. Non-Functional Requirements

## 8.1 Observability & Logging

- All log output is structured JSON via a logging library (e.g., pino or winston).

- Every request is assigned a unique traceId (UUID) via middleware; included in all log entries and error responses.

- Log levels: error, warn, info, debug. Production defaults to info.

- Request logs capture: method, path, status code, duration (ms), userId, traceId.

- Audit events are logged at info level with type: "audit" for easy filtering.

## 8.2 Scalability Considerations

- The service is stateless per request (JWT auth, no server-side sessions), enabling horizontal scaling behind a load balancer.

- The in-memory store is acknowledged as a single-instance limitation; the design.md describes the migration path to a distributed document store (e.g., MongoDB, DynamoDB).

- Pagination and filtering prevent unbounded response sizes.

- The async job queue would migrate to a distributed broker (e.g., Redis/BullMQ, SQS) in production.

- File storage abstraction allows swapping local disk for S3/GCS with no endpoint changes.

## 8.3 Code Quality Practices

- Linting: ESLint with @typescript-eslint plugin, Prettier for formatting.

- Type Safety: Strict TypeScript (strict: true in tsconfig); Zod schemas for runtime validation that double as TypeScript types.

- Testing Philosophy: Unit tests for business logic and validation; integration tests for endpoint behavior using supertest; test coverage target ≥ 80%.

- Modular Architecture: Separate layers for routes, controllers, services, repositories, middleware, and validators. Each module has a single responsibility.

- No dead code, no commented-out blocks, no TODO markers in submitted code.

- Consistent error handling via centralized error middleware.

# 9. Technology Choices & Justification

| **Technology** | **Purpose** | **Justification** |
| --- | --- | --- |
| Express.js | HTTP framework | Mature, minimal, widely adopted. Flexible middleware model suits the auth/validation/logging pipeline. Low overhead for a focused API service. |
| Zod | Validation & schemas | TypeScript-first schema validation. Generates TS types from schemas (single source of truth). Rich error messages with field-level detail. |
| jsonwebtoken | JWT auth | Standard JWT library for Node.js. Supports HS256 signing, expiration verification, and payload extraction. |
| uuid | ID generation | RFC 4122 compliant UUID v4 generation. Cryptographically random, collision-resistant. |
| multer | File uploads | De facto Express middleware for multipart/form-data. Configurable limits, storage engines, and file filtering. |
| pino | Logging | High-performance structured JSON logger. Low overhead, serializer support, and child loggers for request context. |
| helmet | Security headers | Sets security-related HTTP headers (HSTS, X-Frame-Options, etc.) with sensible defaults. |
| In-memory Map | Data persistence | No external DB required per spec. Map provides O(1) lookups. Clear migration path to document DB. |
| vitest / jest | Testing | Fast, TypeScript-native test runner. Built-in mocking and assertion libraries. |

# 10. Project Structure

The following directory layout enforces separation of concerns and mirrors a production Node.js/TypeScript project:

```
src/                ← Application root
  config/           ← Environment config, constants
  middleware/       ← Auth, validation, logging, error handling
  routes/           ← Express route definitions
  controllers/      ← Request/response handling (thin layer)
  services/         ← Business logic and orchestration
  repositories/     ← Data access layer (in-memory store)
  models/           ← TypeScript interfaces and Zod schemas
  queue/            ← Async job queue and handlers
  storage/          ← File storage abstraction
  utils/            ← Shared helpers (sanitization, token generation)
  __tests__/        ← Unit and integration tests
design.md           ← Design write-up
README.md           ← Setup, usage, API docs, curl examples
```

# 11. Implementation Plan (5-Day Sprint)

## Day 1: Foundation & Data Layer

- Initialize project: TypeScript, ESLint, Prettier, tsconfig (strict mode).

- Define all TypeScript interfaces and Zod validation schemas for Report, Entry, Comment, Attachment.

- Implement in-memory repository (ReportRepository) with CRUD operations and unique businessKey enforcement.

- Set up Express app skeleton with health-check endpoint.

- Commit: "feat: project init, data models, in-memory repository"

## Day 2: Auth, POST & GET Endpoints

- Implement JWT middleware (authentication + role extraction).

- Build POST /reports endpoint with validation, sanitization, ID generation, and 201 response.

- Build GET /reports/:id endpoint with full/summary views, include filtering, pagination, sorting.

- Implement computed fields calculation service.

- Add structured logging middleware with traceId.

- Commit: "feat: auth middleware, POST and GET endpoints"

## Day 3: PUT Endpoint & Business Rules

- Build PUT /reports/:id with partial update, optimistic concurrency (version/If-Match), and idempotency key cache.

- Implement audit trail service (before/after snapshots).

- Implement custom business rule (status transition gate).

- Build centralized error handling middleware with consistent error schema.

- Commit: "feat: PUT endpoint, concurrency control, business rules, audit"

## Day 4: File Upload & Async Queue

- Build POST /reports/:id/attachment with multer, file validation, and local storage.

- Implement FileStorageService interface and LocalDiskStorage.

- Build download endpoint with signed token generation and verification.

- Implement in-memory job queue with retry/backoff and dead-letter queue.

- Wire async side effect into POST /reports flow.

- Commit: "feat: file upload, secure download, async job queue"

## Day 5: Testing, Documentation & Polish

- Write unit tests for validators, business rules, computed fields.

- Write integration tests for all four endpoints (happy path + error cases).

- Write README.md with setup instructions, auth usage, curl examples.

- Write design.md covering all required sections.

- Final code review: remove dead code, verify linting, ensure type safety.

- Commit: "docs: README, design write-up" and "test: full test suite"

# 12. Deliverables Checklist

| **#** | **Deliverable** | **Status** |
| --- | --- | --- |
| 1 | Source code with meaningful commit history | Planned |
| 2 | Four functional endpoints (GET, POST, PUT, file upload) | Planned |
| 3 | In-memory NoSQL data model with 10+ fields | Planned |
| 4 | JWT authentication with reader/editor/admin roles | Planned |
| 5 | Input validation with Zod; structured error responses | Planned |
| 6 | Optimistic concurrency control (version + If-Match) | Planned |
| 7 | Idempotency key support on PUT | Planned |
| 8 | Audit logging (before/after snapshots) | Planned |
| 9 | Async side-effect queue with retry, backoff, DLQ | Planned |
| 10 | File upload with type/size validation | Planned |
| 11 | Secure file download with signed expiring tokens | Planned |
| 12 | Custom business rule (status transition gate) | Planned |
| 13 | Structured JSON logging with traceId | Planned |
| 14 | README.md with setup, auth, curl examples | Planned |
| 15 | design.md with all required sections | Planned |
| 16 | Unit and integration test suite | Planned |

# 13. Design Write-Up Outline (design.md)

The design.md deliverable must cover the following sections, each with contextual justification (not generic boilerplate):

- Schema and Data Model – Document structure rationale, field choices, index strategy for future migration, handling of nested collections vs. references.

- Authentication/Authorization Model – JWT structure, role hierarchy, middleware pipeline, token lifecycle, future considerations (refresh tokens, OAuth).

- Concurrency Control Approach – Why optimistic over pessimistic, version field mechanics, conflict resolution UX, idempotency implementation.

- File Storage/Access Security – Abstraction layer design, signed URL generation, token TTL decisions, virus scanning integration plan.

- Asynchronous Side Effect Strategy – Queue design, retry/backoff formula, DLQ behavior, compensating markers, migration to distributed broker.

- Code Quality Practices – Linting rules, type safety approach, testing strategy, commit conventions, PR review philosophy.

- Scaling and Observability – Stateless design for horizontal scaling, logging pipeline, metrics (future), tracing correlation, data store migration path.

- Evolving Spec Mentality – How the architecture absorbs new computed metrics, additional views, new roles, or new endpoints with minimal rework.

# 14. Stated Assumptions

- The service runs as a single instance for the assessment; the design accommodates multi-instance deployment.

- HTTPS/TLS termination is handled by a reverse proxy (e.g., Nginx, ALB) in production.

- The in-memory data store resets on restart; this is acceptable for the assessment scope.

- File uploads are stored on local disk under ./uploads/; production would use S3 or equivalent.

- Download token TTL is 1 hour; this is configurable via environment variable.

- The admin role is included for the custom business rule; the spec requires at least reader and editor.

- Rate limiting is described but not implemented in the assessment.

- Pagination defaults (page=1, size=20) are chosen to balance usability and performance.

- BusinessKey format (RPT-YYYY-NNNN) uses an in-memory counter; production would use an atomic sequence.