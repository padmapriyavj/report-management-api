import { JwtPayload } from "../models/auth.model";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload; // Set by auth middleware after JWT verification
      traceId?: string; // Set by logger middleware for request tracing
    }
  }
}

export {};