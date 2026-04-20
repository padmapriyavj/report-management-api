import { JwtPayload } from "../models/auth.model";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      traceId?: string;
    }
  }
}

export {};