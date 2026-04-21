/**
 * Unit tests for Zod validation schemas.
 *
 * Each model has a schema that validates incoming data before it touches
 * our business logic. These tests cover boundary conditions like min/max
 * lengths, required fields, and invalid enum values.
 */

import { describe, it, expect } from "vitest";
import { createReportSchema, updateReportSchema } from "../models/report.model";
import { createEntrySchema } from "../models/entry.model";
import { createCommentSchema } from "../models/comment.model";

describe("Report Validation", () => {
  // Basic happy path with all common fields
  it("accepts valid report input", () => {
    const result = createReportSchema.safeParse({
      title: "Valid Report",
      description: "A test report",
      priority: "high",
      tags: ["urgent", "review"],
    });

    expect(result.success).toBe(true);
  });

  // Only title is required - everything else gets defaults
  it("applies defaults for optional fields", () => {
    const result = createReportSchema.safeParse({
      title: "Minimal Report",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe("medium");
      expect(result.data.tags).toEqual([]);
      expect(result.data.entries).toEqual([]);
      expect(result.data.metadata).toEqual({});
    }
  });

  // Title must be at least 3 characters
  it("rejects title shorter than 3 characters", () => {
    const result = createReportSchema.safeParse({ title: "ab" });

    expect(result.success).toBe(false);
  });

  // Title maxes out at 200 characters
  it("rejects title longer than 200 characters", () => {
    const result = createReportSchema.safeParse({
      title: "a".repeat(201),
    });

    expect(result.success).toBe(false);
  });

  // Title is the only required field
  it("rejects missing title", () => {
    const result = createReportSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  // Priority must be one of: low, medium, high, critical
  it("rejects invalid priority value", () => {
    const result = createReportSchema.safeParse({
      title: "Test",
      priority: "urgent",
    });

    expect(result.success).toBe(false);
  });

  // Limit tags to prevent abuse
  it("rejects more than 20 tags", () => {
    const result = createReportSchema.safeParse({
      title: "Test",
      tags: Array(21).fill("tag"),
    });

    expect(result.success).toBe(false);
  });

  // Strict mode - no extra fields allowed
  it("rejects unknown fields", () => {
    const result = createReportSchema.safeParse({
      title: "Test Report",
      hackedField: true,
    });

    expect(result.success).toBe(false);
  });
});

describe("Update Report Validation", () => {
  // PUT can update just one field at a time
  it("accepts partial update", () => {
    const result = updateReportSchema.safeParse({
      title: "Updated Title",
    });

    expect(result.success).toBe(true);
  });

  // Empty body is valid - useful for triggering side effects
  it("accepts empty body (no changes)", () => {
    const result = updateReportSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  // Status must be a valid enum value
  it("rejects invalid status", () => {
    const result = updateReportSchema.safeParse({
      status: "invalid_status",
    });

    expect(result.success).toBe(false);
  });
});

describe("Entry Validation", () => {
  // Entry with all fields populated
  it("accepts valid entry", () => {
    const result = createEntrySchema.safeParse({
      content: "Valid entry content",
      amount: 100,
      status: "pending",
    });

    expect(result.success).toBe(true);
  });

  // Entries must have actual content
  it("rejects empty content", () => {
    const result = createEntrySchema.safeParse({
      content: "",
    });

    expect(result.success).toBe(false);
  });

  // Entry content has a 10k character limit
  it("rejects content over 10000 characters", () => {
    const result = createEntrySchema.safeParse({
      content: "a".repeat(10001),
    });

    expect(result.success).toBe(false);
  });

  // Strict mode for entries too
  it("rejects unknown fields on entry", () => {
    const result = createEntrySchema.safeParse({
      content: "Test",
      hacked: true,
    });

    expect(result.success).toBe(false);
  });
});

describe("Comment Validation", () => {
  // Simple comment with just text
  it("accepts valid comment", () => {
    const result = createCommentSchema.safeParse({
      text: "This is a comment",
    });

    expect(result.success).toBe(true);
  });

  // Comments must have actual text
  it("rejects empty comment text", () => {
    const result = createCommentSchema.safeParse({
      text: "",
    });

    expect(result.success).toBe(false);
  });

  // Whitespace-only is treated as empty
  it("trims whitespace-only text and rejects it", () => {
    const result = createCommentSchema.safeParse({
      text: "   ",
    });

    expect(result.success).toBe(false);
  });
});
