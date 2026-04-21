import crypto from "crypto";
import { config } from "../config";

/**
 * Verify a download token is valid and not expired.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyDownloadToken(
  token: string,
  expectedKey: string
): boolean {
  // Token format: "signature:expiresTimestamp"
  const parts = token.split(":");
  if (parts.length !== 2) return false;

  const [signature, expiresStr] = parts;
  const expires = parseInt(expiresStr, 10);

  // Check expiration first
  if (isNaN(expires) || Date.now() > expires) return false;

  // Recompute expected signature and compare
  const payload = `${expectedKey}:${expires}`;
  const expectedSignature = crypto
    .createHmac("sha256", config.jwt.secret)
    .update(payload)
    .digest("hex");

  // Timing-safe comparison prevents timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
