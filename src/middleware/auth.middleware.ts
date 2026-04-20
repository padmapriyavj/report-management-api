import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { jwtPayloadSchema, JwtPayload } from "../models/auth.model";
import { Role } from "../models/auth.model";

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

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
    const decoded = jwt.verify(token, config.jwt.secret);

    if (typeof decoded === "string") {
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid token format",
        },
      });
      return;
    }

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
        message:
          err instanceof jwt.TokenExpiredError
            ? "Token has expired"
            : "Invalid token",
      },
    });
  }
}

export function authorize(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

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
