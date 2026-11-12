import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; businessId: string; role: Role };
    }
  }
}
export {};
