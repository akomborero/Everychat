"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const tenant_scope_1 = require("./tenant-scope");
const B = "biz_A";
(0, node_test_1.default)("reads are scoped, and a caller-supplied different businessId is overwritten", () => {
    const out = (0, tenant_scope_1.scopeArgs)("Customer", "findMany", { where: { businessId: "biz_B", name: "x" } }, B);
    strict_1.default.equal(out.where.businessId, B);
    strict_1.default.equal(out.where.name, "x");
});
(0, node_test_1.default)("an OR clause cannot escape the tenant: the scope is ANDed at the top level", () => {
    const out = (0, tenant_scope_1.scopeArgs)("Message", "findFirst", { where: { OR: [{ businessId: "biz_B" }, { id: "1" }] } }, B);
    strict_1.default.equal(out.where.businessId, B);
    strict_1.default.equal(out.where.OR.length, 2);
});
(0, node_test_1.default)("a missing where is created", () => strict_1.default.deepEqual((0, tenant_scope_1.scopeArgs)("Lead", "count", undefined, B), { where: { businessId: B } }));
(0, node_test_1.default)("every read, update and delete operation is scoped", () => {
    for (const op of ["findMany", "findFirst", "findFirstOrThrow", "count", "aggregate", "groupBy", "updateMany", "deleteMany", "findUnique", "findUniqueOrThrow", "update", "delete"]) {
        strict_1.default.equal((0, tenant_scope_1.scopeArgs)("Appointment", op, { where: { id: "1" } }, B).where.businessId, B, op);
    }
});
(0, node_test_1.default)("create stamps the tenant and overrides a different one", () => {
    strict_1.default.equal((0, tenant_scope_1.scopeArgs)("Customer", "create", { data: { phone: "1", businessId: "biz_B" } }, B).data.businessId, B);
});
(0, node_test_1.default)("createMany stamps every row, single or list", () => {
    strict_1.default.deepEqual((0, tenant_scope_1.scopeArgs)("Lead", "createMany", { data: [{ a: 1 }, { a: 2, businessId: "biz_B" }] }, B).data.map((d) => d.businessId), [B, B]);
    strict_1.default.equal((0, tenant_scope_1.scopeArgs)("Lead", "createMany", { data: { a: 1 } }, B).data[0].businessId, B);
});
(0, node_test_1.default)("upsert scopes the lookup and the creation", () => {
    const out = (0, tenant_scope_1.scopeArgs)("WhatsappAccount", "upsert", { where: { phoneNumberId: "1" }, create: { phoneNumberId: "1" }, update: {} }, B);
    strict_1.default.equal(out.where.businessId, B);
    strict_1.default.equal(out.create.businessId, B);
});
(0, node_test_1.default)("operations that are not explicitly handled are refused", () => {
    for (const op of ["createManyAndReturn", "updateManyAndReturn", "$queryRaw", "somethingNew"]) {
        strict_1.default.throws(() => (0, tenant_scope_1.scopeArgs)("Message", op, {}, B), /not allowed on tenant data/, op);
    }
});
(0, node_test_1.default)("non-tenant models pass through untouched", () => {
    const args = { where: { email: "a@b.c" } };
    strict_1.default.equal((0, tenant_scope_1.scopeArgs)("User", "findUnique", args, B), args);
});
(0, node_test_1.default)("the caller's object is never mutated", () => {
    const args = { where: { id: "1" } };
    (0, tenant_scope_1.scopeArgs)("Lead", "findMany", args, B);
    strict_1.default.deepEqual(args, { where: { id: "1" } });
});
// The guard that catches a forgotten model: every model in schema.prisma that has a businessId column must be listed.
(0, node_test_1.default)("TENANT_MODELS matches every schema model that has a businessId", () => {
    const schema = node_fs_1.default.readFileSync(node_path_1.default.resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    const withBusinessId = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].filter((m) => /^\s+businessId\s/m.test(m[2])).map((m) => m[1]).sort();
    strict_1.default.deepEqual([...tenant_scope_1.TENANT_MODELS].sort(), withBusinessId);
});
