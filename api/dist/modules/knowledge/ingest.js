"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractText = extractText;
exports.ingest = ingest;
exports.processUpload = processUpload;
const mammoth = __importStar(require("mammoth"));
const pdf_parse_js_1 = __importDefault(require("pdf-parse/lib/pdf-parse.js"));
const prisma_1 = require("../../lib/prisma");
const llm_1 = require("../ai/llm");
const chunk_1 = require("./chunk");
const vector_1 = require("./vector");
const events_1 = require("../../lib/events");
const MAX_TEXT = 500_000;
async function extractText(buffer, ext) {
    if (ext === ".pdf")
        return (await (0, pdf_parse_js_1.default)(buffer)).text;
    if (ext === ".docx")
        return (await mammoth.extractRawText({ buffer })).value;
    return buffer.toString("utf8"); // .txt, .md
}
/** Chunks, embeds and stores a document's text. Never throws: failures are recorded on the document. */
async function ingest(businessId, documentId, text) {
    const db = (0, prisma_1.tenantDb)(businessId);
    try {
        const chunks = (0, chunk_1.chunkText)(text.slice(0, MAX_TEXT));
        if (!chunks.length)
            throw new Error("No readable text found. Scanned PDFs need OCR, which is not supported yet.");
        let tokens = 0;
        const vectors = [];
        for (let i = 0; i < chunks.length; i += 64) {
            const r = await llm_1.llm.embed(chunks.slice(i, i + 64));
            vectors.push(...r.vectors);
            tokens += r.tokens;
        }
        await db.knowledgeChunk.deleteMany({ where: { documentId } });
        await (0, vector_1.insertChunks)(businessId, documentId, chunks.map((content, i) => ({ content, embedding: vectors[i] })));
        await db.knowledgeDocument.update({ where: { id: documentId }, data: { status: "ready", error: null } });
        if (tokens)
            await db.usageRecord.create({ data: { businessId, type: "AI_INPUT_TOKENS", quantity: tokens } });
    }
    catch (e) {
        console.error(`Ingest failed for document ${documentId}:`, e);
        const message = e instanceof Error ? e.message : "Processing failed";
        await db.knowledgeDocument
            .update({ where: { id: documentId }, data: { status: "failed", error: message.slice(0, 300) } })
            .catch(() => undefined);
    }
    finally {
        (0, events_1.publishChange)(businessId);
    }
}
async function processUpload(businessId, documentId, buffer, ext) {
    const db = (0, prisma_1.tenantDb)(businessId);
    try {
        const text = await extractText(buffer, ext);
        await db.knowledgeDocument.update({ where: { id: documentId }, data: { content: text.slice(0, MAX_TEXT) } });
        await ingest(businessId, documentId, text);
    }
    catch (e) {
        console.error(`Extraction failed for document ${documentId}:`, e);
        await db.knowledgeDocument
            .update({ where: { id: documentId }, data: { status: "failed", error: "Could not read this file. Is it password protected or corrupted?" } })
            .catch(() => undefined);
        (0, events_1.publishChange)(businessId);
    }
}
