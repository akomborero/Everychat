import path from "path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { tenantDb } from "../../lib/prisma";
import { AppError, ah } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";
import { ingest, processUpload } from "./ingest";
import { groupQuestions } from "../../lib/analytics";
import { HOUR, perBusiness } from "../../lib/rateLimits";

export const knowledgeRoutes = Router();
knowledgeRoutes.use(requireAuth);
const canEdit = requireRole("OWNER", "ADMIN");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const SUPPORTED = [".pdf", ".docx", ".txt", ".md"];
const listSelect = { id: true, name: true, kind: true, status: true, error: true, createdAt: true } as const;

knowledgeRoutes.get(
  "/documents",
  ah(async (req, res) => {
    const documents = await tenantDb(req.auth!.businessId).knowledgeDocument.findMany({
      orderBy: { createdAt: "desc" },
      select: listSelect,
    });
    res.json({ documents });
  }),
);

// File upload. Processing happens in the background; poll GET /documents for status.
knowledgeRoutes.post(
  "/documents/upload",
  canEdit,
  perBusiness(30, HOUR),
  upload.single("file"),
  ah(async (req, res) => {
    const file = req.file;
    if (!file) throw new AppError(400, 'Attach a file in the "file" field');
    const ext = path.extname(file.originalname).toLowerCase();
    if (!SUPPORTED.includes(ext)) throw new AppError(400, "Supported files: PDF, Word (.docx), TXT and MD");

    const { businessId } = req.auth!;
    const document = await tenantDb(businessId).knowledgeDocument.create({
      data: { businessId, name: file.originalname.slice(0, 200), kind: "UPLOAD", status: "processing" },
      select: listSelect,
    });
    res.status(202).json({ document });
    void processUpload(businessId, document.id, file.buffer, ext);
  }),
);

// Typed FAQ. Short, so it is processed before responding.
knowledgeRoutes.post(
  "/faqs",
  canEdit,
  ah(async (req, res) => {
    const d = z.object({ question: z.string().trim().min(3).max(300), answer: z.string().trim().min(1).max(3000) }).parse(req.body);
    const { businessId } = req.auth!;
    const db = tenantDb(businessId);
    const content = `Question: ${d.question}\nAnswer: ${d.answer}`;
    const doc = await db.knowledgeDocument.create({ data: { businessId, name: d.question, kind: "FAQ", content, status: "processing" } });
    await ingest(businessId, doc.id, content);
    res.status(201).json({ document: await db.knowledgeDocument.findFirst({ where: { id: doc.id }, select: listSelect }) });
  }),
);

// Typed notes: policies, delivery terms, anything that is not a price or FAQ.
knowledgeRoutes.post(
  "/notes",
  canEdit,
  ah(async (req, res) => {
    const d = z.object({ title: z.string().trim().min(1).max(200), content: z.string().trim().min(1).max(20_000) }).parse(req.body);
    const { businessId } = req.auth!;
    const db = tenantDb(businessId);
    const doc = await db.knowledgeDocument.create({ data: { businessId, name: d.title, kind: "NOTE", content: d.content, status: "processing" } });
    await ingest(businessId, doc.id, `${d.title}\n\n${d.content}`);
    res.status(201).json({ document: await db.knowledgeDocument.findFirst({ where: { id: doc.id }, select: listSelect }) });
  }),
);

// Chunks are removed by the database (ON DELETE CASCADE).
knowledgeRoutes.delete(
  "/documents/:id",
  canEdit,
  ah(async (req, res) => {
    const { count } = await tenantDb(req.auth!.businessId).knowledgeDocument.deleteMany({ where: { id: req.params.id } });
    if (!count) throw new AppError(404, "Document not found");
    res.status(204).end();
  }),
);

// Questions the AI could not answer from the business's information, grouped so repeats show once.
knowledgeRoutes.get(
  "/gaps",
  ah(async (req, res) => {
    const rows = await tenantDb(req.auth!.businessId).knowledgeGap.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, question: true, createdAt: true },
    });
    res.json({ gaps: groupQuestions(rows).map((g) => ({ key: g.key, question: g.question, count: g.count, ids: g.ids, lastAt: g.lastAt })) });
  }),
);

knowledgeRoutes.patch(
  "/gaps",
  canEdit,
  ah(async (req, res) => {
    const d = z.object({ ids: z.array(z.string().min(1)).min(1).max(200), status: z.enum(["resolved", "dismissed"]) }).parse(req.body);
    const { count } = await tenantDb(req.auth!.businessId).knowledgeGap.updateMany({ where: { id: { in: d.ids }, status: "open" }, data: { status: d.status } });
    res.json({ updated: count });
  }),
);
