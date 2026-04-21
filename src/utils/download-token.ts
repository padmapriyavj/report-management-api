import crypto from "crypto";
import { config } from "../config";

export function verifyDownloadToken(
  token: string,
  expectedKey: string
): boolean {
  const parts = token.split(":");
  if (parts.length !== 2) return false;

  const [signature, expiresStr] = parts;
  const expires = parseInt(expiresStr, 10);

  if (isNaN(expires) || Date.now() > expires) return false;

  const payload = `${expectedKey}:${expires}`;
  const expectedSignature = crypto
    .createHmac("sha256", config.jwt.secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
