/**
 * Unit tests for the status transition validation service.
 *
 * Reports follow a strict state machine: draft → in_review → approved → archived.
 * Different roles have different permissions for each transition, and some
 * transitions have preconditions (like requiring at least one entry).
 */

import { describe, it, expect } from "vitest";
import { validateTransition } from "../services/transition.service";
import { Report } from "../models/report.model";

// Factory function for creating test reports
function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: "test-id",
    businessKey: "RPT-2026-0001",
    title: "Test Report",
    description: "Test",
    status: "draft",
    priority: "medium",
    category: undefined,
    tags: [],
    createdBy: "user-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: "user-1",
    version: 1,
    entries: [],
    comments: [],
    attachments: [],
    metadata: {},
    ...overrides,
  };
}

describe("Status Transition Validation", () => {
  // Standard workflow: editor submits report for review
  it("allows editor to move draft → in_review with entries", () => {
    const report = makeReport({
      status: "draft",
      entries: [
        {
          id: "e1",
          content: "Entry",
          status: "pending",
          priority: "medium",
          createdAt: new Date().toISOString(),
          createdBy: "user-1",
        },
      ],
    });

    expect(() =>
      validateTransition(report, "in_review", "editor")
    ).not.toThrow();
  });

  // Only admins can approve - this is a key business rule
  it("allows admin to move in_review → approved", () => {
    const report = makeReport({ status: "in_review" });
    expect(() => validateTransition(report, "approved", "admin")).not.toThrow();
  });

  // Final step: archiving an approved report
  it("allows editor to move approved → archived", () => {
    const report = makeReport({ status: "approved" });
    expect(() =>
      validateTransition(report, "archived", "editor")
    ).not.toThrow();
  });

  // Editors can send reports back to draft for revisions
  it("allows editor to move in_review → draft", () => {
    const report = makeReport({ status: "in_review" });
    expect(() => validateTransition(report, "draft", "editor")).not.toThrow();
  });

  // No-op: setting status to current value should pass silently
  it("does nothing when status is unchanged", () => {
    const report = makeReport({ status: "draft" });
    expect(() => validateTransition(report, "draft", "reader")).not.toThrow();
  });

  // Can't submit an empty report for review
  it("rejects draft → in_review with no entries", () => {
    const report = makeReport({ status: "draft", entries: [] });

    expect(() => validateTransition(report, "in_review", "editor")).toThrow(
      "Report must have at least one entry"
    );
  });

  // Editors can't approve their own reports - requires admin
  it("rejects editor from approving (in_review → approved)", () => {
    const report = makeReport({ status: "in_review" });

    expect(() => validateTransition(report, "approved", "editor")).toThrow(
      "Role 'editor' cannot transition"
    );
  });

  // Must go through in_review first - no skipping steps
  it("rejects direct draft → approved", () => {
    const report = makeReport({ status: "draft" });

    expect(() => validateTransition(report, "approved", "admin")).toThrow(
      "Cannot transition from 'draft' to 'approved'"
    );
  });

  // Archived is a terminal state - reports are immutable once archived
  it("rejects any modification to archived reports", () => {
    const report = makeReport({ status: "archived" });

    expect(() => validateTransition(report, "draft", "admin")).toThrow(
      "Archived reports cannot be modified"
    );
  });

  // Readers are view-only - they cannot change report status
  it("rejects reader from any transition", () => {
    const report = makeReport({
      status: "draft",
      entries: [
        {
          id: "e1",
          content: "Entry",
          status: "pending",
          priority: "medium",
          createdAt: new Date().toISOString(),
          createdBy: "user-1",
        },
      ],
    });

    expect(() => validateTransition(report, "in_review", "reader")).toThrow(
      "Role 'reader' cannot transition"
    );
  });
});
