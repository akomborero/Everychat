import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "../../lib/prisma";

// Raw SQL bypasses tenantDb, so EVERY query in this file must filter by "businessId" explicitly.

const toVector = (v: number[]) => `[${v.join(",")}]`;

export async function insertChunks(businessId: string, documentId: string, chunks: { content: string; embedding: number[] }[]) {
  for (let i = 0; i < chunks.length; i += 50) {
    const rows = chunks
      .slice(i, i + 50)
      .map((c) => Prisma.sql`(${randomUUID()}, ${businessId}, ${documentId}, ${c.content}, ${toVector(c.embedding)}::vector)`);
    await prisma.$executeRaw`
      INSERT INTO "KnowledgeChunk" (id, "businessId", "documentId", content, embedding)
      VALUES ${Prisma.join(rows)}`;
  }
}

export async function searchChunks(businessId: string, embedding: number[], limit = 5, minScore = 0.2) {
  const v = toVector(embedding);
  const rows = await prisma.$queryRaw<{ content: string; score: number }[]>`
    SELECT content, 1 - (embedding <=> ${v}::vector) AS score
    FROM "KnowledgeChunk"
    WHERE "businessId" = ${businessId} AND embedding IS NOT NULL
    ORDER BY embedding <=> ${v}::vector
    LIMIT ${limit}`;
  return rows.filter((r) => Number(r.score) >= minScore);
}
