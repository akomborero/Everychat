import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { scopeArgs, TENANT_MODELS } from "./tenant-scope";

const B = "biz_A";

test("reads are scoped, and a caller-supplied different businessId is overwritten", () => {
  const out = scopeArgs("Customer", "findMany", { where: { businessId: "biz_B", name: "x" } }, B);
  assert.equal(out.where.businessId, B);
  assert.equal(out.where.name, "x");
});
test("an OR clause cannot escape the tenant: the scope is ANDed at the top level", () => {
  const out = scopeArgs("Message", "findFirst", { where: { OR: [{ businessId: "biz_B" }, { id: "1" }] } }, B);
  assert.equal(out.where.businessId, B);
  assert.equal(out.where.OR.length, 2);
});
test("a missing where is created", () => assert.deepEqual(scopeArgs("Lead", "count", undefined, B), { where: { businessId: B } }));
test("every read, update and delete operation is scoped", () => {
  for (const op of ["findMany", "findFirst", "findFirstOrThrow", "count", "aggregate", "groupBy", "updateMany", "deleteMany", "findUnique", "findUniqueOrThrow", "update", "delete"]) {
    assert.equal(scopeArgs("Appointment", op, { where: { id: "1" } }, B).where.businessId, B, op);
  }
});
test("create stamps the tenant and overrides a different one", () => {
  assert.equal(scopeArgs("Customer", "create", { data: { phone: "1", businessId: "biz_B" } }, B).data.businessId, B);
});
test("createMany stamps every row, single or list", () => {
  assert.deepEqual(scopeArgs("Lead", "createMany", { data: [{ a: 1 }, { a: 2, businessId: "biz_B" }] }, B).data.map((d: { businessId: string }) => d.businessId), [B, B]);
  assert.equal(scopeArgs("Lead", "createMany", { data: { a: 1 } }, B).data[0].businessId, B);
});
test("upsert scopes the lookup and the creation", () => {
  const out = scopeArgs("WhatsappAccount", "upsert", { where: { phoneNumberId: "1" }, create: { phoneNumberId: "1" }, update: {} }, B);
  assert.equal(out.where.businessId, B); assert.equal(out.create.businessId, B);
});
test("operations that are not explicitly handled are refused", () => {
  for (const op of ["createManyAndReturn", "updateManyAndReturn", "$queryRaw", "somethingNew"]) {
    assert.throws(() => scopeArgs("Message", op, {}, B), /not allowed on tenant data/, op);
  }
});
test("non-tenant models pass through untouched", () => {
  const args = { where: { email: "a@b.c" } };
  assert.equal(scopeArgs("User", "findUnique", args, B), args);
});
test("the caller's object is never mutated", () => {
  const args = { where: { id: "1" } };
  scopeArgs("Lead", "findMany", args, B);
  assert.deepEqual(args, { where: { id: "1" } });
});

// The guard that catches a forgotten model: every model in schema.prisma that has a businessId column must be listed.
test("TENANT_MODELS matches every schema model that has a businessId", () => {
  const schema = fs.readFileSync(path.resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
  const withBusinessId = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].filter((m) => /^\s+businessId\s/m.test(m[2])).map((m) => m[1]).sort();
  assert.deepEqual([...TENANT_MODELS].sort(), withBusinessId);
});
