import { z } from "zod";

export const roleEnum = z.enum(["reader", "editor", "admin"]);

// Expected shape of the decoded JWT payload
export const jwtPayloadSchema = z.object({
  userId: z.string().min(1),
  role: roleEnum,
});

export type Role = z.infer<typeof roleEnum>;
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
