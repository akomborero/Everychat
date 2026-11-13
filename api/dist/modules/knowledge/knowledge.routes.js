"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.knowledgeRoutes = void 0;
const path_1 = __importDefault(require("path"));
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const auth_1 = require("../../middleware/auth");
const ingest_1 = require("./ingest");
const analytics_1 = require("../../lib/analytics");
const rateLimits_1 = require("../../lib/rateLimits");
exports.knowledgeRoutes = (0, express_1.Router)();
exports.knowledgeRoutes.use(auth_1.requireAuth);
const canEdit = (0, auth_1.requireRole)("OWNER", "ADMIN");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const SUPPORTED = [".pdf", ".docx", ".txt", ".md"];
const listSelect = { id: true, name: true, kind: true, status: true, error: true, createdAt: true };
exports.knowledgeRoutes.get("/documents", (0, errors_1.ah)(async (req, res) => {
    const documents = await (0, prisma_1.tenantDb)(req.auth.businessId).knowledgeDocument.findMany({
        orderBy: { createdAt: "desc" },
        select: listSelect,
    });
    res.json({ documents });
}));
// File upload. Processing happens in the background; poll GET /documents for status.
exports.knowledgeRoutes.post("/documents/upload", canEdit, (0, rateLimits_1.perBusiness)(30, rateLimits_1.HOUR), upload.single("file"), (0, errors_1.ah)(async (req, res) => {
    const file = req.file;
    if (!file)
        throw new errors_1.AppError(400, 'Attach a file in the "file" field');
    const ext = path_1.default.extname(file.originalname).toLowerCase();
    if (!SUPPORTED.includes(ext))
        throw new errors_1.AppError(400, "Supported files: PDF, Word (.docx), TXT and MD");
    const { businessId } = req.auth;
    const document = await (0, prisma_1.tenantDb)(businessId).knowledgeDocument.create({
        data: { businessId, name: file.originalname.slice(0, 200), kind: "UPLOAD", status: "processing" },
        select: listSelect,
    });
    res.status(202).json({ document });
    void (0, ingest_1.processUpload)(businessId, document.id, file.buffer, ext);
}));
// Typed FAQ. Short, so it is processed before responding.
exports.knowledgeRoutes.post("/faqs", canEdit, (0, errors_1.ah)(async (req, res) => {
    const d = zod_1.z.object({ question: zod_1.z.string().trim().min(3).max(300), answer: zod_1.z.string().trim().min(1).max(3000) }).parse(req.body);
    const { businessId } = req.auth;
    const db = (0, prisma_1.tenantDb)(businessId);
    const content = `Question: ${d.question}\nAnswer: ${d.answer}`;
    const doc = await db.knowledgeDocument.create({ data: { businessId, name: d.question, kind: "FAQ", content, status: "processing" } });
    await (0, ingest_1.ingest)(businessId, doc.id, content);
    res.status(201).json({ document: await db.knowledgeDocument.findFirst({ where: { id: doc.id }, select: listSelect }) });
}));
// Typed notes: policies, delivery terms, anything that is not a price or FAQ.
exports.knowledgeRoutes.post("/notes", canEdit, (0, errors_1.ah)(async (req, res) => {
    const d = zod_1.z.object({ title: zod_1.z.string().trim().min(1).max(200), content: zod_1.z.string().trim().min(1).max(20_000) }).parse(req.body);
    const { businessId } = req.auth;
    const db = (0, prisma_1.tenantDb)(businessId);
    const doc = await db.knowledgeDocument.create({ data: { businessId, name: d.title, kind: "NOTE", content: d.content, status: "processing" } });
    await (0, ingest_1.ingest)(businessId, doc.id, `${d.title}\n\n${d.content}`);
    res.status(201).json({ document: await db.knowledgeDocument.findFirst({ where: { id: doc.id }, select: listSelect }) });
}));
// Chunks are removed by the database (ON DELETE CASCADE).
exports.knowledgeRoutes.delete("/documents/:id", canEdit, (0, errors_1.ah)(async (req, res) => {
    const { count } = await (0, prisma_1.tenantDb)(req.auth.businessId).knowledgeDocument.deleteMany({ where: { id: req.params.id } });
    if (!count)
        throw new errors_1.AppError(404, "Document not found");
    res.status(204).end();
}));
// Questions the AI could not answer from the business's information, grouped so repeats show once.
exports.knowledgeRoutes.get("/gaps", (0, errors_1.ah)(async (req, res) => {
    const rows = await (0, prisma_1.tenantDb)(req.auth.businessId).knowledgeGap.findMany({
        where: { status: "open" },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: { id: true, question: true, createdAt: true },
    });
    res.json({ gaps: (0, analytics_1.groupQuestions)(rows).map((g) => ({ key: g.key, question: g.question, count: g.count, ids: g.ids, lastAt: g.lastAt })) });
}));
exports.knowledgeRoutes.patch("/gaps", canEdit, (0, errors_1.ah)(async (req, res) => {
    const d = zod_1.z.object({ ids: zod_1.z.array(zod_1.z.string().min(1)).min(1).max(200), status: zod_1.z.enum(["resolved", "dismissed"]) }).parse(req.body);
    const { count } = await (0, prisma_1.tenantDb)(req.auth.businessId).knowledgeGap.updateMany({ where: { id: { in: d.ids }, status: "open" }, data: { status: d.status } });
    res.json({ updated: count });
}));
