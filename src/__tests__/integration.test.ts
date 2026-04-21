/**
 * Integration tests for the Report Management API.
 *
 * These tests hit the actual Express endpoints using supertest and verify
 * the full request/response cycle including auth, validation, and business rules.
 * Tests run in sequence since some depend on state from earlier tests.
 */

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app";
import { config } from "../config";
import path from "path";
import fs from "fs";

// Helper to generate JWT tokens for different user roles
function makeToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, config.jwt.secret, { expiresIn: "1h" });
}

// Pre-generate tokens for each role we need to test
const editorToken = makeToken("user-1", "editor");
const readerToken = makeToken("user-2", "reader");
const adminToken = makeToken("user-3", "admin");

// Shared state across tests - we create a report and then update it
let reportId: string;
let reportVersion: number;

describe("POST /reports", () => {
  // Happy path: editor creates a new report with entries
  it("creates a report with valid input", async () => {
    const res = await request(app)
      .post("/reports")
      .set("Authorization", `Bearer ${editorToken}`)
      .send({
        title: "Integration Test Report",
        description: "Testing the full flow",
        priority: "high",
        entries: [{ content: "First entry", amount: 100, status: "pending" }],
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.businessKey).toMatch(/^RPT-\d{4}-\d{4}$/);
    expect(res.body.status).toBe("draft");
    expect(res.body.version).toBe(1);
    expect(res.body.createdBy).toBe("user-1");
    expect(res.body.entries).toHaveLength(1);
    expect(res.headers.location).toBe(`/reports/${res.body.id}`);

    // Save for later tests
    reportId = res.body.id;
    reportVersion = res.body.version;
  });

  // Title too short - should fail Zod validation
  it("returns 400 for invalid input", async () => {
    const res = await request(app)
      .post("/reports")
      .set("Authorization", `Bearer ${editorToken}`)
      .send({ title: "ab" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toBeDefined();
  });

  // No auth header at all
  it("returns 401 without token", async () => {
    const res = await request(app)
      .post("/reports")
      .send({ title: "No Auth Report" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  // Readers can view reports but cannot create them
  it("returns 403 for reader role", async () => {
    const res = await request(app)
      .post("/reports")
      .set("Authorization", `Bearer ${readerToken}`)
      .send({ title: "Reader Report" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("GET /reports/:id", () => {
  // Default view returns everything: entries, comments, metrics, pagination
  it("returns full report with metrics", async () => {
    const res = await request(app)
      .get(`/reports/${reportId}`)
      .set("Authorization", `Bearer ${readerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(reportId);
    expect(res.body.entries).toBeDefined();
    expect(res.body.metrics).toBeDefined();
    expect(res.body.metrics.totalEntries).toBe(1);
    expect(res.body.pagination).toBeDefined();
  });

  // Summary view is a flattened response without nested arrays
  it("returns summary view", async () => {
    const res = await request(app)
      .get(`/reports/${reportId}?view=summary`)
      .set("Authorization", `Bearer ${readerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(reportId);
    expect(res.body.totalEntries).toBe(1);
    expect(res.body.entries).toBeUndefined();
    expect(res.body.comments).toBeUndefined();
  });

  // Clients can request specific fields to reduce payload size
  it("respects include parameter", async () => {
    const res = await request(app)
      .get(`/reports/${reportId}?include=entries`)
      .set("Authorization", `Bearer ${readerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.entries).toBeDefined();
    expect(res.body.comments).toBeUndefined();
    expect(res.body.metrics).toBeUndefined();
  });

  // Report doesn't exist - clear error message
  it("returns 404 for non-existent report", async () => {
    const res = await request(app)
      .get("/reports/non-existent-id")
      .set("Authorization", `Bearer ${readerToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  // Even GET requires authentication
  it("returns 401 without token", async () => {
    const res = await request(app).get(`/reports/${reportId}`);

    expect(res.status).toBe(401);
  });
});

describe("PUT /reports/:id", () => {
  // Basic update flow with optimistic locking via If-Match header
  it("updates report with valid input", async () => {
    const res = await request(app)
      .put(`/reports/${reportId}`)
      .set("Authorization", `Bearer ${editorToken}`)
      .set("If-Match", String(reportVersion))
      .send({ title: "Updated Title" });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated Title");
    expect(res.body.version).toBe(reportVersion + 1);

    reportVersion = res.body.version;
  });

  // Stale version number should trigger a conflict error
  it("returns 409 on version mismatch", async () => {
    const res = await request(app)
      .put(`/reports/${reportId}`)
      .set("Authorization", `Bearer ${editorToken}`)
      .set("If-Match", "999")
      .send({ title: "Conflict Test" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  // If-Match header is required for concurrency control
  it("returns 428 without If-Match header", async () => {
    const res = await request(app)
      .put(`/reports/${reportId}`)
      .set("Authorization", `Bearer ${editorToken}`)
      .send({ title: "No Version" });

    expect(res.status).toBe(428);
    expect(res.body.error.code).toBe("PRECONDITION_REQUIRED");
  });

  // Cannot skip steps: draft cannot go directly to approved
  it("enforces status transition rules", async () => {
    const res = await request(app)
      .put(`/reports/${reportId}`)
      .set("Authorization", `Bearer ${editorToken}`)
      .set("If-Match", String(reportVersion))
      .send({ status: "approved" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_TRANSITION");
  });

  // Valid transition: draft can move to in_review if report has entries
  it("allows draft → in_review with entries", async () => {
    const res = await request(app)
      .put(`/reports/${reportId}`)
      .set("Authorization", `Bearer ${editorToken}`)
      .set("If-Match", String(reportVersion))
      .send({ status: "in_review" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("in_review");

    reportVersion = res.body.version;
  });

  // Editors can submit for review but only admins can approve
  it("rejects editor approving report", async () => {
    const res = await request(app)
      .put(`/reports/${reportId}`)
      .set("Authorization", `Bearer ${editorToken}`)
      .set("If-Match", String(reportVersion))
      .send({ status: "approved" });

    expect(res.status).toBe(403);
  });

  // Admin role has permission to approve reports
  it("allows admin to approve", async () => {
    const res = await request(app)
      .put(`/reports/${reportId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("If-Match", String(reportVersion))
      .send({ status: "approved" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");

    reportVersion = res.body.version;
  });

  // Idempotency: same key returns cached response without re-running the update
  it("returns cached response for same idempotency key", async () => {
    const key = "idem-test-123";

    const res1 = await request(app)
      .put(`/reports/${reportId}`)
      .set("Authorization", `Bearer ${editorToken}`)
      .set("If-Match", String(reportVersion))
      .set("Idempotency-Key", key)
      .send({ status: "archived" });

    const res2 = await request(app)
      .put(`/reports/${reportId}`)
      .set("Authorization", `Bearer ${editorToken}`)
      .set("If-Match", String(reportVersion))
      .set("Idempotency-Key", key)
      .send({ status: "archived" });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.version).toBe(res2.body.version);

    reportVersion = res1.body.version;
  });
});

describe("POST /reports/:id/attachment", () => {
  let testReportId: string;

  // Create a fresh report for attachment tests
  beforeAll(async () => {
    const res = await request(app)
      .post("/reports")
      .set("Authorization", `Bearer ${editorToken}`)
      .send({ title: "Attachment Test Report" });

    testReportId = res.body.id;
  });

  // Upload a PDF and verify we get back a download token
  it("uploads a file successfully", async () => {
    const testFilePath = path.join(__dirname, "test-upload.pdf");
    fs.writeFileSync(testFilePath, "fake pdf content");

    const res = await request(app)
      .post(`/reports/${testReportId}/attachment`)
      .set("Authorization", `Bearer ${editorToken}`)
      .attach("file", testFilePath);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.filename).toBe("test-upload.pdf");
    expect(res.body.downloadToken).toBeDefined();
    expect(res.body.tokenExpiresAt).toBeDefined();

    fs.unlinkSync(testFilePath);
  });

  // Can't attach a file to a report that doesn't exist
  it("returns 404 for non-existent report", async () => {
    const testFilePath = path.join(__dirname, "test-upload.pdf");
    fs.writeFileSync(testFilePath, "fake pdf content");

    const res = await request(app)
      .post("/reports/non-existent-id/attachment")
      .set("Authorization", `Bearer ${editorToken}`)
      .attach("file", testFilePath);

    expect(res.status).toBe(404);

    fs.unlinkSync(testFilePath);
  });

  // File uploads require authentication
  it("returns 401 without token", async () => {
    const testFilePath = path.join(__dirname, "test-upload.pdf");
    fs.writeFileSync(testFilePath, "fake pdf content");

    const res = await request(app)
      .post(`/reports/${testReportId}/attachment`)
      .attach("file", testFilePath);

    expect(res.status).toBe(401);

    fs.unlinkSync(testFilePath);
  });

  // Readers cannot upload files - only editors and admins can
  it("returns 403 for reader role", async () => {
    const res = await request(app)
      .post(`/reports/${testReportId}/attachment`)
      .set("Authorization", `Bearer ${readerToken}`)
      .send();

    expect(res.status).toBe(403);
  });
});
