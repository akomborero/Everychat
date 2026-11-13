"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertChunks = insertChunks;
exports.searchChunks = searchChunks;
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const prisma_1 = require("../../lib/prisma");
// Raw SQL bypasses tenantDb, so EVERY query in this file must filter by "businessId" explicitly.
const toVector = (v) => `[${v.join(",")}]`;
async function insertChunks(businessId, documentId, chunks) {
    for (let i = 0; i < chunks.length; i += 50) {
        const rows = chunks
            .slice(i, i + 50)
            .map((c) => client_1.Prisma.sql `(${(0, crypto_1.randomUUID)()}, ${businessId}, ${documentId}, ${c.content}, ${toVector(c.embedding)}::vector)`);
        await prisma_1.prisma.$executeRaw `
      INSERT INTO "KnowledgeChunk" (id, "businessId", "documentId", content, embedding)
      VALUES ${client_1.Prisma.join(rows)}`;
    }
}
async function searchChunks(businessId, embedding, limit = 5, minScore = 0.2) {
    const v = toVector(embedding);
    const rows = await prisma_1.prisma.$queryRaw `
    SELECT content, 1 - (embedding <=> ${v}::vector) AS score
    FROM "KnowledgeChunk"
    WHERE "businessId" = ${businessId} AND embedding IS NOT NULL
    ORDER BY embedding <=> ${v}::vector
    LIMIT ${limit}`;
    return rows.filter((r) => Number(r.score) >= minScore);
}
