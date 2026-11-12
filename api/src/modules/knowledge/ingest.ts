import * as mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { tenantDb } from "../../lib/prisma";
import { llm } from "../ai/llm";
import { chunkText } from "./chunk";
import { insertChunks } from "./vector";
import { publishChange } from "../../lib/events";

const MAX_TEXT = 500_000;

export async function extractText(buffer: Buffer, ext: string): Promise<string> {
  if (ext === ".pdf") return (await pdfParse(buffer)).text;
  if (ext === ".docx") return (await mammoth.extractRawText({ buffer })).value;
  return buffer.toString("utf8"); // .txt, .md
}

/** Chunks, embeds and stores a document's text. Never throws: failures are recorded on the document. */
export async function ingest(businessId: string, documentId: string, text: string) {
  const db = tenantDb(businessId);
  try {
    const chunks = chunkText(text.slice(0, MAX_TEXT));
    if (!chunks.length) throw new Error("No readable text found. Scanned PDFs need OCR, which is not supported yet.");

    let tokens = 0;
    const vectors: number[][] = [];
    for (let i = 0; i < chunks.length; i += 64) {
      const r = await llm.embed(chunks.slice(i, i + 64));
      vectors.push(...r.vectors);
      tokens += r.tokens;
    }

    await db.knowledgeChunk.deleteMany({ where: { documentId } });
    await insertChunks(businessId, documentId, chunks.map((content, i) => ({ content, embedding: vectors[i] })));
    await db.knowledgeDocument.update({ where: { id: documentId }, data: { status: "ready", error: null } });
    if (tokens) await db.usageRecord.create({ data: { businessId, type: "AI_INPUT_TOKENS", quantity: tokens } });
  } catch (e) {
    console.error(`Ingest failed for document ${documentId}:`, e);
    const message = e instanceof Error ? e.message : "Processing failed";
    await db.knowledgeDocument
      .update({ where: { id: documentId }, data: { status: "failed", error: message.slice(0, 300) } })
      .catch(() => undefined);
  } finally {
    publishChange(businessId);
  }
}

export async function processUpload(businessId: string, documentId: string, buffer: Buffer, ext: string) {
  const db = tenantDb(businessId);
  try {
    const text = await extractText(buffer, ext);
    await db.knowledgeDocument.update({ where: { id: documentId }, data: { content: text.slice(0, MAX_TEXT) } });
    await ingest(businessId, documentId, text);
  } catch (e) {
    console.error(`Extraction failed for document ${documentId}:`, e);
    await db.knowledgeDocument
      .update({ where: { id: documentId }, data: { status: "failed", error: "Could not read this file. Is it password protected or corrupted?" } })
      .catch(() => undefined);
    publishChange(businessId);
  }
}
