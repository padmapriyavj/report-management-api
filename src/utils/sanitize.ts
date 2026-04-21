export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

/**
 * Recursively sanitize all strings in an object or array.
 * Preserves the structure, just cleans the string values.
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === "string") {
    return stripHtml(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as T;
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeObject(value);
    }
    return result as T;
  }

  // Numbers, booleans, null, undefined pass through unchanged
  return obj;
}
