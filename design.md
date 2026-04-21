# Design Write-Up

This document explains the key design decisions behind the Report Management API, covering schema design, authentication, concurrency, file handling, async processing, code quality, scalability, and extensibility. Each section addresses tradeoffs specific to this project rather than restating general best practices.

---

## 1. Schema and Data Model

The data model follows a document-oriented design where the Report is the central aggregate containing nested Entry, Comment, and Attachment sub-documents. This was a deliberate choice over a relational approach with separate collections linked by foreign keys.

The reasoning is straightforward: reports and their entries are always read and written together. A GET request returns the full report with all its nested data in one operation. Splitting entries into a separate collection would require joins or multiple lookups on every read, adding complexity with no benefit for this access pattern. The nested approach also makes optimistic concurrency simpler, the version field on the report covers the entire aggregate, so any change to an entry or attachment bumps the report version.

Each sub-document carries its own UUID identifier, which allows targeted operations on specific entries or attachments without ambiguity. Timestamps use ISO 8601 strings rather than Date objects for consistent serialization and comparison.

The schema includes 17 fields on the Report document plus three nested collections, well exceeding the minimum of 10. Fields like `businessKey` (format RPT-YYYY-NNNN) provide a human-readable identifier alongside the UUID, which is common in enterprise systems where users need to reference reports verbally or in emails.

Zod schemas serve as the single source of truth for both runtime validation and TypeScript type generation. There are separate schemas for client input (what the API accepts) and stored documents (what lives in memory). This separation prevents clients from setting server-managed fields like `id`, `createdAt`, or `version`. Input schemas use `.strict()` to reject unknown fields, while internal schemas do not, leaving room for the model to evolve without breaking internal consumers.

For future migration to a persistent store like MongoDB, the document structure maps directly, no schema transformation needed. The `businessKey` field would need a unique index, and the `id` field would map to `_id` or retain a secondary unique index. The in-memory `businessKeyIndex` Map mirrors what a database index would provide, demonstrating awareness of data access patterns even in a prototype.

Metadata is stored as a flexible key-value record with a cap of 10 keys. This provides extensibility for domain-specific attributes without requiring schema changes, while the cap prevents unbounded growth.

---

## 2. Authentication and Authorization Model

The API uses JWT bearer tokens with HMAC-SHA256 signing. Tokens carry a `userId` and `role` in the payload, and the server validates both the signature and the payload structure on every request.

The authentication middleware runs first in the pipeline. It extracts the token from the Authorization header, verifies it with `jsonwebtoken`, then validates the payload shape with Zod. This two-step approach catches tokens that are validly signed but carry malformed or missing data, a scenario that can arise from misconfigured token issuers or manual token crafting.

Authorization is handled by a separate middleware that accepts a list of allowed roles. This is a higher-order function pattern: `authorize(['editor', 'admin'])` returns a middleware that checks the authenticated user's role against the allowed list. The separation means authentication and authorization can be composed independently per route, and adding a new role requires no changes to the middleware itself.

Three roles exist: `reader`, `editor`, and `admin`. The PRD requires at least reader and editor; admin was added to support the custom business rule where only administrators can approve reports. The role hierarchy is implicit in the route definitions rather than encoded as a formal hierarchy, which keeps the implementation simple while covering all required permission checks.

The JWT secret is loaded from the `JWT_SECRET` environment variable. In development, a random secret is generated at startup as a convenience, but this means tokens are invalidated on every restart. In production, the secret would be provided through environment configuration or a secrets manager to ensure persistence across deployments.

Token expiration is set to 1 hour. Refresh token flow is out of scope for this assessment but would be a natural addition: issue a long-lived refresh token alongside the access token, and provide a `/auth/refresh` endpoint that accepts the refresh token and returns a new access token. For production, migrating to an OAuth 2.0 provider or integrating with an identity service like Auth0 would offload token management entirely.

---

## 3. Concurrency Control Approach

The API uses optimistic concurrency control via a `version` field on each report and the `If-Match` HTTP header. The client must include the current version number in the `If-Match` header when submitting an update. If the version matches, the update proceeds and the version increments. If it does not match, the server returns 409 Conflict with the current version number so the client can fetch the latest state and retry.

Optimistic concurrency was chosen over pessimistic locking because the expected access pattern involves low contention most reports are edited by one person at a time. Pessimistic locking (acquiring a lock before editing) would require lock management, timeout handling, and deadlock detection, none of which are justified for this workload. Optimistic concurrency is also stateless per request, which aligns with the horizontal scaling goal.

The `If-Match` header is required, not optional. The server returns 428 Precondition Required if it is missing. This forces clients to acknowledge the current state before modifying it, preventing accidental overwrites from clients that are unaware of concurrency control.

When a conflict occurs, the 409 response includes the current version number in the error details. This gives the client enough information to fetch the latest report, merge their changes, and retry without an additional round trip to discover the current version.

Idempotency is handled through an optional `Idempotency-Key` header on PUT requests. When provided, the server caches the response keyed by that value with a 24-hour TTL. If the same key appears in a subsequent request, the cached response is returned without re-executing the update. This prevents duplicate mutations from network retries, which is particularly important for operations that trigger side effects or audit entries.

The idempotency cache uses lazy expiration entries are checked for TTL validity on read rather than removed by a background timer. This is simple and sufficient for a single-instance service. In a distributed deployment, the cache would move to Redis with native TTL support.

---

## 4. File Storage and Access Security

File storage is abstracted behind a `FileStorageService` interface with four methods: `put`, `get`, `delete`, and `generateSignedUrl`. The current implementation is `LocalDiskStorage`, which writes files to disk under an `uploads/` directory organized by report ID.

The abstraction exists so that switching to cloud object storage (S3, GCS) requires implementing the same interface without changing any endpoint or service logic. The interface uses `Promise` return types on all methods even though local disk operations could be synchronous, because cloud storage operations are inherently asynchronous. Designing the interface around the more constrained case means the local implementation is slightly over-abstracted, but the cloud implementation would work without interface changes.

File uploads are validated at two levels. Multer enforces the 10 MB size limit and rejects files before they reach application code. The file filter checks MIME types against an allowlist defined in the config. The service layer enforces a per-report attachment cap of 10 files.

Download access uses signed tokens rather than direct file serving. When a file is uploaded, the server generates an HMAC-SHA256 token that encodes the storage key and an expiration timestamp. To download, the client must present this token as a query parameter. The server verifies the signature and checks expiration. Expired tokens return 410 Gone (telling the client to request a new token), while invalid signatures return 403 Forbidden.

The token TTL defaults to 1 hour and is configurable via environment variable. The signature uses `crypto.timingSafeEqual` for comparison to prevent timing attacks.

For production, uploaded files would pass through a virus scanning pipeline before being made available. The approach would be: upload to a quarantine location, trigger a scan via ClamAV or a cloud-native service, and move the file to the active store only after a clean result. The attachment record would carry a `scanStatus` field (pending, clean, infected) and downloads would be blocked while the status is not clean.

---

## 5. Asynchronous Side Effect Strategy

When a report is created, the API enqueues an asynchronous job representing a notification or cache invalidation task. The job executes after the HTTP response has been sent, so failures in the side effect do not block or fail the API call.

The queue is implemented in-memory with a handler registry pattern. Job types are registered with handler functions at application startup, and `enqueueJob` dispatches jobs by type. This decouples the queue infrastructure from the specific job logic adding a new side effect means registering a new handler, not modifying the queue.

Failure handling follows a retry-with-backoff strategy. Failed jobs are retried up to 3 times with exponential backoff: 1 second, 2 seconds, 4 seconds (base delay multiplied by 2^attempt). The formula is `baseDelayMs * 2^(attempt - 1)`, which provides increasing breathing room between retries without excessive wait times.

After exhausting all retries, the job is moved to a dead-letter queue (DLQ) with the original payload, error message, and attempt count. DLQ entries are logged at error level with `type: "job_dead_lettered"` for filtering. In a production system, a compensating marker would be set on the report (such as `sideEffectStatus: "failed"`) so that operators can identify reports with failed notifications and take corrective action.

The current in-memory implementation is single-instance only. For production, the queue would migrate to a distributed broker like Redis with BullMQ or AWS SQS. The handler registry pattern would carry over directly only the transport layer changes. Job serialization would shift from in-memory objects to JSON messages, and the retry/backoff logic would be handled by the broker's native capabilities.

---

## 6. Code Quality Practices

TypeScript is configured with `strict: true`, which enables `strictNullChecks`, `noImplicitAny`, and related flags. This catches null reference errors and untyped values at compile time rather than at runtime. Every function parameter and return type is either explicitly annotated or inferred from a Zod schema.

Zod schemas are the single source of truth for data shapes. TypeScript types are derived from schemas using `z.infer<typeof schema>`, which eliminates the possibility of drift between validation rules and type definitions. There are separate schemas for input (client-facing, with `.strict()`) and storage (internal, without `.strict()`), reflecting the principle that boundaries should be strict while internals should be flexible.

The codebase follows a layered architecture with clear dependency direction: routes call controllers, controllers call services, services call repositories. No layer reaches upward. Controllers never contain business logic, and services never touch HTTP request/response objects. This separation makes each layer independently testable.

The project uses conventional commit messages following the pattern `type: description` (feat, fix, docs, test, chore). Each commit represents a complete, compilable unit of work rather than a work-in-progress snapshot.

Testing covers three levels. Unit tests validate business rules (status transitions), computed fields (metrics calculations), and validation schemas (Zod parsing) in isolation. Integration tests exercise the full HTTP stack using supertest, covering happy paths and error cases for all four endpoints. The test suite runs in under 500ms, which supports rapid iteration.

Input sanitization strips HTML tags recursively from all string fields before storage, preventing stored XSS. The sanitizer handles nested objects and arrays, so entry content inside a report body is sanitized along with top-level fields.

---

## 7. Scaling and Observability

The service is stateless per request. Authentication is token-based with no server-side sessions, and no request depends on which instance handles it. This means horizontal scaling behind a load balancer is straightforward add more instances, point the load balancer at them.

The primary scaling limitation is the in-memory data store, which is single-instance by design. Migration to a distributed document store like MongoDB or DynamoDB would require replacing the `ReportRepository` implementation while keeping the same interface. The Map-based secondary index on `businessKey` would become a database unique index. The `businessKey` sequence counter would need an atomic increment operation, either from the database or a distributed counter service.

Similarly, the idempotency cache and job queue are in-memory and single-instance. The cache would move to Redis with native TTL support, and the queue would move to Redis/BullMQ or SQS with built-in retry and dead-letter capabilities.

All log output is structured JSON via Pino. Every request is assigned a UUID `traceId` via middleware, and this ID appears in all log entries, error responses, and audit records generated during that request. This enables correlation given a traceId from an error response, an operator can filter logs to see the complete request lifecycle.

Request logs capture method, path, status code, duration in milliseconds, userId, and traceId. Audit events are logged with `type: "audit"` for easy filtering. Job lifecycle events use types like `job_enqueued`, `job_completed`, and `job_dead_lettered`.

For production, the logging pipeline would feed into a centralized system like ELK or Datadog. Application metrics (request rate, latency percentiles, error rate, queue depth) would be exposed via Prometheus or a similar collector. Distributed tracing with OpenTelemetry would extend the traceId correlation across service boundaries if the system evolves into multiple services.

---

## 8. Evolving Spec Mentality

The architecture is designed to absorb changes with minimal rework. Here are concrete examples of how specific types of changes would be handled.

Adding a new computed metric (such as average entry amount) requires adding one field to the metrics schema and one line of calculation in the metrics service. No endpoint changes, no controller changes, no database migration.

Adding a new response view (such as a detailed audit view) means adding one conditional branch in the `getReportById` service function and one new value to the view query parameter validation. Existing views are untouched.

Adding a new role (such as `reviewer`) means adding the value to the role enum in the auth model, adding entries to the status transition matrix, and updating the `authorize` calls on affected routes. The middleware itself does not change.

Adding a new endpoint (such as `POST /reports/:id/comments`) means creating a controller function, a service function, and a route entry. The existing layered architecture provides a clear pattern to follow.

Adding a new status (such as `withdrawn`) means adding it to the status enum and adding transition rules to the matrix. The matrix is data-driven — no branching logic needs to be rewritten.

These are not theoretical claims. The patterns used throughout the codebase data-driven transition matrix, handler registry for jobs, strategy pattern for storage, schema composition with Zod were chosen specifically because they localize the impact of changes. The goal is that a new requirement touches one or two files, not ten.
