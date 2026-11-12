import { PrismaClient } from "@prisma/client";
import { scopeArgs } from "./tenant-scope";

/** Unscoped client. Only use for platform-level models (User, Business) and webhook routing. */
export const prisma = new PrismaClient();

/**
 * Returns a client that forces `businessId` onto every query for tenant models (see tenant-scope.ts).
 * Business A's code path cannot read or write Business B's rows, even by mistake.
 */
export function tenantDb(businessId: string) {
  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(scopeArgs(model, operation, args, businessId));
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;
