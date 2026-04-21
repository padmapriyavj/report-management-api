import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { jwtPayloadSchema } from "../models/auth.model";
import { Role } from "../models/auth.model";

/**
 * Verify the JWT token from the Authorization header.
 * Attaches the decoded user info to req.user for downstream use.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  // Expect "Bearer <token>" format
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or malformed Authorization header",
      },
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    // Verify signature and expiration
    const decoded = jwt.verify(token, config.jwt.secret);

    // jwt.verify can return a string for some edge cases - we need an object
    if (typeof decoded === "string") {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid token format",
        },
      });
      return;
    }

    // Validate the payload has the fields we expect (userId, role)
    const result = jwtPayloadSchema.safeParse(decoded);

    if (!result.success) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Token payload is invalid",
        },
      });
      return;
    }

    req.user = result.data;
    next();
  } catch (err) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: err instanceof jwt.TokenExpiredError ? "Token has expired" : "Invalid token",
      },
    });
  }
}

/**
 * Check if the authenticated user has one of the allowed roles.
 * Use after authenticate() middleware.
 *
 * Example: authorize(["editor", "admin"]) allows editors and admins.
 */
export function authorize(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    // Should not happen if authenticate() ran first, but just in case
    if (!user) {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: `Requires one of: ${allowedRoles.join(", ")}`,
        },
      });
      return;
    }
    next();
  };
}
