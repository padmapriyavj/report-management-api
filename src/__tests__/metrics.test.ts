/**
 * Unit tests for the metrics calculation service.
 *
 * The API computes several derived fields on each report (totalEntries,
 * completionRate, etc.) before returning them to clients. These tests
 * verify that logic against various report states.
 */

import { describe, it, expect } from "vitest";
import { calculateMetrics } from "../services/metrics.service";
import { Report } from "../models/report.model";

// Factory function to create test reports with sensible defaults
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

// Factory for creating test entries within a report
function makeEntry(overrides: Partial<Report["entries"][0]> = {}) {
  return {
    id: "entry-1",
    content: "Test entry",
    status: "pending" as const,
    priority: "medium" as const,
    createdAt: new Date().toISOString(),
    createdBy: "user-1",
    ...overrides,
  };
}

describe("Calculate Metrics", () => {
  // Edge case: brand new report with no entries yet
  it("returns zero metrics for empty report", () => {
    const report = makeReport();
    const metrics = calculateMetrics(report);

    expect(metrics.totalEntries).toBe(0);
    expect(metrics.totalAmount).toBe(0);
    expect(metrics.completionRate).toBe(0);
    expect(metrics.derivedStatus).toBe("pending");
    expect(metrics.trendIndicator).toBe("stable");
    expect(metrics.highPriorityCount).toBe(0);
    expect(metrics.commentCount).toBe(0);
    expect(metrics.attachmentCount).toBe(0);
    expect(metrics.lastActivityAt).toBeNull();
  });

  // Basic aggregation: count entries and sum their amounts
  it("counts entries and sums amounts", () => {
    const report = makeReport({
      entries: [
        makeEntry({ id: "e1", amount: 100 }),
        makeEntry({ id: "e2", amount: 250 }),
        makeEntry({ id: "e3" }),
      ],
    });
    const metrics = calculateMetrics(report);

    expect(metrics.totalEntries).toBe(3);
    expect(metrics.totalAmount).toBe(350);
  });

  // Completion rate is (completed entries / total entries) * 100
  it("calculates completion rate correctly", () => {
    const report = makeReport({
      entries: [
        makeEntry({ id: "e1", status: "completed" }),
        makeEntry({ id: "e2", status: "completed" }),
        makeEntry({ id: "e3", status: "pending" }),
      ],
    });
    const metrics = calculateMetrics(report);

    expect(metrics.completionRate).toBe(66.7);
  });

  // All entries done = 100% completion
  it("returns 100% when all entries completed", () => {
    const report = makeReport({
      entries: [
        makeEntry({ id: "e1", status: "completed" }),
        makeEntry({ id: "e2", status: "completed" }),
      ],
    });
    const metrics = calculateMetrics(report);

    expect(metrics.completionRate).toBe(100);
  });

  // derivedStatus should be "complete" when 100% done
  it("returns complete when all entries done", () => {
    const report = makeReport({
      entries: [makeEntry({ id: "e1", status: "completed" })],
    });
    const metrics = calculateMetrics(report);

    expect(metrics.derivedStatus).toBe("complete");
  });

  // derivedStatus is "in_progress" when more than half of entries are done
  it("returns in_progress when over 50% done", () => {
    const report = makeReport({
      entries: [
        makeEntry({ id: "e1", status: "completed" }),
        makeEntry({ id: "e2", status: "completed" }),
        makeEntry({ id: "e3", status: "pending" }),
      ],
    });
    const metrics = calculateMetrics(report);

    expect(metrics.derivedStatus).toBe("in_progress");
  });

  // derivedStatus is "pending" when less than half are completed
  it("returns pending when under 50% done", () => {
    const report = makeReport({
      entries: [
        makeEntry({ id: "e1", status: "completed" }),
        makeEntry({ id: "e2", status: "pending" }),
        makeEntry({ id: "e3", status: "pending" }),
      ],
    });
    const metrics = calculateMetrics(report);

    expect(metrics.derivedStatus).toBe("pending");
  });

  // highPriorityCount includes both "high" and "critical" entries
  it("counts high and critical priority entries", () => {
    const report = makeReport({
      entries: [
        makeEntry({ id: "e1", priority: "high" }),
        makeEntry({ id: "e2", priority: "critical" }),
        makeEntry({ id: "e3", priority: "low" }),
        makeEntry({ id: "e4", priority: "medium" }),
      ],
    });
    const metrics = calculateMetrics(report);

    expect(metrics.highPriorityCount).toBe(2);
  });

  // Simple counts for related collections
  it("counts comments and attachments", () => {
    const report = makeReport({
      comments: [
        {
          id: "c1",
          text: "Comment",
          authorId: "user-1",
          createdAt: new Date().toISOString(),
        },
        {
          id: "c2",
          text: "Comment 2",
          authorId: "user-1",
          createdAt: new Date().toISOString(),
        },
      ],
      attachments: [
        {
          id: "a1",
          filename: "test.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1000,
          storagePath: "/test",
          uploadedBy: "user-1",
          uploadedAt: new Date().toISOString(),
          downloadToken: "token",
          tokenExpiresAt: new Date().toISOString(),
        },
      ],
    });
    const metrics = calculateMetrics(report);

    expect(metrics.commentCount).toBe(2);
    expect(metrics.attachmentCount).toBe(1);
  });
});
