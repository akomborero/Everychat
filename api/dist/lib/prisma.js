"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.tenantDb = tenantDb;
const client_1 = require("@prisma/client");
const tenant_scope_1 = require("./tenant-scope");
/** Unscoped client. Only use for platform-level models (User, Business) and webhook routing. */
exports.prisma = new client_1.PrismaClient();
/**
 * Returns a client that forces `businessId` onto every query for tenant models (see tenant-scope.ts).
 * Business A's code path cannot read or write Business B's rows, even by mistake.
 */
function tenantDb(businessId) {
    return exports.prisma.$extends({
        name: "tenant-scope",
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }) {
                    return query((0, tenant_scope_1.scopeArgs)(model, operation, args, businessId));
                },
            },
        },
    });
}
