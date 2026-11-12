import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { tenantDb } from "../../lib/prisma";
import { AppError, ah } from "../../lib/errors";
import { requireAuth, requireRole } from "../../middleware/auth";
import { sendText } from "../whatsapp/whatsapp.client";
import { MINUTE, perBusiness } from "../../lib/rateLimits";

export const conversationRoutes = Router();
conversationRoutes.use(requireAuth);

const canReply = requireRole("OWNER", "ADMIN", "STAFF");
const assignee = { select: { id: true, name: true } } as const;

conversationRoutes.get(
  "/",
  ah(async (req, res) => {
    const { userId, businessId } = req.auth!;
    const q = z
      .object({
        status: z.enum(["OPEN", "NEEDS_HUMAN", "CLOSED"]).optional(),
        filter: z.enum(["open", "mine", "unassigned", "needs", "closed"]).default("open"),
        q: z.string().trim().max(100).optional(),
      })
      .parse(req.query);

    let where: Prisma.ConversationWhereInput;
    if (q.status) where = { status: q.status };
    else if (q.filter === "mine") where = { assignedToId: userId, status: { not: "CLOSED" } };
    else if (q.filter === "unassigned") where = { assignedToId: null, status: { not: "CLOSED" } };
    else if (q.filter === "needs") where = { status: "NEEDS_HUMAN" };
    else if (q.filter === "closed") where = { status: "CLOSED" };
    else where = { status: { not: "CLOSED" } };

    // Search by customer name or number, or by words in any message of the conversation.
    if (q.q) {
      where = {
        AND: [where, { OR: [
          { customer: { name: { contains: q.q, mode: "insensitive" } } },
          { customer: { phone: { contains: q.q } } },
          { messages: { some: { body: { contains: q.q, mode: "insensitive" } } } },
        ] }],
      };
    }

    const conversations = await tenantDb(businessId).conversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      take: 50,
      include: { customer: true, assignedTo: assignee, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    res.json({ conversations });
  }),
);

conversationRoutes.get(
  "/:id/messages",
  ah(async (req, res) => {
    const db = tenantDb(req.auth!.businessId);
    const conversation = await db.conversation.findFirst({ where: { id: req.params.id }, include: { customer: true, assignedTo: assignee, whatsappAccount: { select: { displayPhone: true } } } });
    if (!conversation) throw new AppError(404, "Conversation not found");
    const messages = await db.message.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" }, take: 200 });
    res.json({ conversation, messages });
  }),
);

// Staff reply. Sending as a human switches the AI off for this conversation.
conversationRoutes.post(
  "/:id/messages",
  canReply,
  perBusiness(300, MINUTE),
  ah(async (req, res) => {
    const { text } = z.object({ text: z.string().trim().min(1).max(4000) }).parse(req.body);
    const { businessId, userId } = req.auth!;
    const db = tenantDb(businessId);

    const conversation = await db.conversation.findFirst({ where: { id: req.params.id }, include: { customer: true } });
    if (!conversation) throw new AppError(404, "Conversation not found");

    // Send first: if WhatsApp rejects it (for example outside the 24 hour window), nothing is saved.
    const { waMessageId } = await sendText(businessId, conversation.customer.phone, text, conversation.whatsappAccountId);

    const message = await db.message.create({
      data: { businessId, conversationId: conversation.id, sender: "STAFF", body: text, waMessageId: waMessageId ?? null, deliveryStatus: "sent" },
    });
    await db.conversation.update({
      where: { id: conversation.id },
      data: { aiEnabled: false, status: "OPEN", assignedToId: conversation.assignedToId ?? userId, lastMessageAt: new Date() },
    });
    await db.usageRecord.create({ data: { businessId, type: "WHATSAPP_OUTBOUND", quantity: 1 } });
    res.status(201).json({ message });
  }),
);

async function mustFind(req: { auth?: { businessId: string }; params: { id: string } }) {
  const db = tenantDb(req.auth!.businessId);
  const c = await db.conversation.findFirst({ where: { id: req.params.id }, select: { id: true } });
  if (!c) throw new AppError(404, "Conversation not found");
  return db;
}

conversationRoutes.post(
  "/:id/takeover",
  canReply,
  ah(async (req, res) => {
    const db = await mustFind(req);
    const conversation = await db.conversation.update({ where: { id: req.params.id }, data: { aiEnabled: false, status: "OPEN", assignedToId: req.auth!.userId } });
    res.json({ conversation });
  }),
);

conversationRoutes.post(
  "/:id/handback",
  canReply,
  ah(async (req, res) => {
    const db = await mustFind(req);
    const conversation = await db.conversation.update({ where: { id: req.params.id }, data: { aiEnabled: true, status: "OPEN", assignedToId: null } });
    res.json({ conversation });
  }),
);

conversationRoutes.put(
  "/:id/assign",
  canReply,
  ah(async (req, res) => {
    const { userId } = z.object({ userId: z.string().min(1).nullable() }).parse(req.body);
    const db = await mustFind(req);
    if (userId && !(await db.teamMember.findFirst({ where: { userId }, select: { id: true } }))) throw new AppError(400, "That person is not on your team");
    const conversation = await db.conversation.update({ where: { id: req.params.id }, data: { assignedToId: userId }, include: { assignedTo: assignee } });
    res.json({ conversation });
  }),
);

// A closed conversation stays in history. If the customer writes again, a fresh conversation starts.
conversationRoutes.post(
  "/:id/close",
  canReply,
  ah(async (req, res) => {
    const db = await mustFind(req);
    const conversation = await db.conversation.update({ where: { id: req.params.id }, data: { status: "CLOSED" } });
    res.json({ conversation });
  }),
);

conversationRoutes.post(
  "/:id/reopen",
  canReply,
  ah(async (req, res) => {
    const db = await mustFind(req);
    const conversation = await db.conversation.update({ where: { id: req.params.id }, data: { status: "OPEN" } });
    res.json({ conversation });
  }),
);

// ---------- internal notes (never sent to the customer) ----------

conversationRoutes.get(
  "/:id/notes",
  ah(async (req, res) => {
    const db = await mustFind(req);
    const notes = await db.conversationNote.findMany({ where: { conversationId: req.params.id }, orderBy: { createdAt: "asc" }, include: { author: assignee } });
    res.json({ notes });
  }),
);

conversationRoutes.post(
  "/:id/notes",
  canReply,
  ah(async (req, res) => {
    const { body } = z.object({ body: z.string().trim().min(1).max(2000) }).parse(req.body);
    const db = await mustFind(req);
    const note = await db.conversationNote.create({
      data: { businessId: req.auth!.businessId, conversationId: req.params.id, authorId: req.auth!.userId, body },
      include: { author: assignee },
    });
    res.status(201).json({ note });
  }),
);

conversationRoutes.delete(
  "/:id/notes/:noteId",
  canReply,
  ah(async (req, res) => {
    const db = await mustFind(req);
    const note = await db.conversationNote.findFirst({ where: { id: req.params.noteId, conversationId: req.params.id } });
    if (!note) throw new AppError(404, "Note not found");
    const isAdmin = req.auth!.role === "OWNER" || req.auth!.role === "ADMIN";
    if (note.authorId !== req.auth!.userId && !isAdmin) throw new AppError(403, "You can only delete your own notes");
    await db.conversationNote.deleteMany({ where: { id: note.id } });
    res.status(204).end();
  }),
);

// ---------- rating an AI reply ----------

conversationRoutes.put(
  "/:id/messages/:messageId/feedback",
  canReply,
  ah(async (req, res) => {
    const d = z.object({ rating: z.enum(["up", "down"]).nullable(), note: z.string().trim().max(500).optional() }).parse(req.body);
    const db = await mustFind(req);
    const msg = await db.message.findFirst({ where: { id: req.params.messageId, conversationId: req.params.id, sender: "AI" }, select: { id: true } });
    if (!msg) throw new AppError(404, "AI message not found");
    const message = await db.message.update({
      where: { id: msg.id },
      data: d.rating
        ? { feedback: d.rating, feedbackNote: d.rating === "down" ? d.note ?? null : null, feedbackAt: new Date() }
        : { feedback: null, feedbackNote: null, feedbackAt: null },
    });
    res.json({ message });
  }),
);
