"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const auth_1 = require("../../middleware/auth");
const whatsapp_client_1 = require("../whatsapp/whatsapp.client");
const rateLimits_1 = require("../../lib/rateLimits");
exports.conversationRoutes = (0, express_1.Router)();
exports.conversationRoutes.use(auth_1.requireAuth);
const canReply = (0, auth_1.requireRole)("OWNER", "ADMIN", "STAFF");
const assignee = { select: { id: true, name: true } };
exports.conversationRoutes.get("/", (0, errors_1.ah)(async (req, res) => {
    const { userId, businessId } = req.auth;
    const q = zod_1.z
        .object({
        status: zod_1.z.enum(["OPEN", "NEEDS_HUMAN", "CLOSED"]).optional(),
        filter: zod_1.z.enum(["open", "mine", "unassigned", "needs", "closed"]).default("open"),
        q: zod_1.z.string().trim().max(100).optional(),
    })
        .parse(req.query);
    let where;
    if (q.status)
        where = { status: q.status };
    else if (q.filter === "mine")
        where = { assignedToId: userId, status: { not: "CLOSED" } };
    else if (q.filter === "unassigned")
        where = { assignedToId: null, status: { not: "CLOSED" } };
    else if (q.filter === "needs")
        where = { status: "NEEDS_HUMAN" };
    else if (q.filter === "closed")
        where = { status: "CLOSED" };
    else
        where = { status: { not: "CLOSED" } };
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
    const conversations = await (0, prisma_1.tenantDb)(businessId).conversation.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        take: 50,
        include: { customer: true, assignedTo: assignee, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    res.json({ conversations });
}));
exports.conversationRoutes.get("/:id/messages", (0, errors_1.ah)(async (req, res) => {
    const db = (0, prisma_1.tenantDb)(req.auth.businessId);
    const conversation = await db.conversation.findFirst({ where: { id: req.params.id }, include: { customer: true, assignedTo: assignee, whatsappAccount: { select: { displayPhone: true } } } });
    if (!conversation)
        throw new errors_1.AppError(404, "Conversation not found");
    const messages = await db.message.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" }, take: 200 });
    res.json({ conversation, messages });
}));
// Staff reply. Sending as a human switches the AI off for this conversation.
exports.conversationRoutes.post("/:id/messages", canReply, (0, rateLimits_1.perBusiness)(300, rateLimits_1.MINUTE), (0, errors_1.ah)(async (req, res) => {
    const { text } = zod_1.z.object({ text: zod_1.z.string().trim().min(1).max(4000) }).parse(req.body);
    const { businessId, userId } = req.auth;
    const db = (0, prisma_1.tenantDb)(businessId);
    const conversation = await db.conversation.findFirst({ where: { id: req.params.id }, include: { customer: true } });
    if (!conversation)
        throw new errors_1.AppError(404, "Conversation not found");
    // Send first: if WhatsApp rejects it (for example outside the 24 hour window), nothing is saved.
    const { waMessageId } = await (0, whatsapp_client_1.sendText)(businessId, conversation.customer.phone, text, conversation.whatsappAccountId);
    const message = await db.message.create({
        data: { businessId, conversationId: conversation.id, sender: "STAFF", body: text, waMessageId: waMessageId ?? null, deliveryStatus: "sent" },
    });
    await db.conversation.update({
        where: { id: conversation.id },
        data: { aiEnabled: false, status: "OPEN", assignedToId: conversation.assignedToId ?? userId, lastMessageAt: new Date() },
    });
    await db.usageRecord.create({ data: { businessId, type: "WHATSAPP_OUTBOUND", quantity: 1 } });
    res.status(201).json({ message });
}));
async function mustFind(req) {
    const db = (0, prisma_1.tenantDb)(req.auth.businessId);
    const c = await db.conversation.findFirst({ where: { id: req.params.id }, select: { id: true } });
    if (!c)
        throw new errors_1.AppError(404, "Conversation not found");
    return db;
}
exports.conversationRoutes.post("/:id/takeover", canReply, (0, errors_1.ah)(async (req, res) => {
    const db = await mustFind(req);
    const conversation = await db.conversation.update({ where: { id: req.params.id }, data: { aiEnabled: false, status: "OPEN", assignedToId: req.auth.userId } });
    res.json({ conversation });
}));
exports.conversationRoutes.post("/:id/handback", canReply, (0, errors_1.ah)(async (req, res) => {
    const db = await mustFind(req);
    const conversation = await db.conversation.update({ where: { id: req.params.id }, data: { aiEnabled: true, status: "OPEN", assignedToId: null } });
    res.json({ conversation });
}));
exports.conversationRoutes.put("/:id/assign", canReply, (0, errors_1.ah)(async (req, res) => {
    const { userId } = zod_1.z.object({ userId: zod_1.z.string().min(1).nullable() }).parse(req.body);
    const db = await mustFind(req);
    if (userId && !(await db.teamMember.findFirst({ where: { userId }, select: { id: true } })))
        throw new errors_1.AppError(400, "That person is not on your team");
    const conversation = await db.conversation.update({ where: { id: req.params.id }, data: { assignedToId: userId }, include: { assignedTo: assignee } });
    res.json({ conversation });
}));
// A closed conversation stays in history. If the customer writes again, a fresh conversation starts.
exports.conversationRoutes.post("/:id/close", canReply, (0, errors_1.ah)(async (req, res) => {
    const db = await mustFind(req);
    const conversation = await db.conversation.update({ where: { id: req.params.id }, data: { status: "CLOSED" } });
    res.json({ conversation });
}));
exports.conversationRoutes.post("/:id/reopen", canReply, (0, errors_1.ah)(async (req, res) => {
    const db = await mustFind(req);
    const conversation = await db.conversation.update({ where: { id: req.params.id }, data: { status: "OPEN" } });
    res.json({ conversation });
}));
// ---------- internal notes (never sent to the customer) ----------
exports.conversationRoutes.get("/:id/notes", (0, errors_1.ah)(async (req, res) => {
    const db = await mustFind(req);
    const notes = await db.conversationNote.findMany({ where: { conversationId: req.params.id }, orderBy: { createdAt: "asc" }, include: { author: assignee } });
    res.json({ notes });
}));
exports.conversationRoutes.post("/:id/notes", canReply, (0, errors_1.ah)(async (req, res) => {
    const { body } = zod_1.z.object({ body: zod_1.z.string().trim().min(1).max(2000) }).parse(req.body);
    const db = await mustFind(req);
    const note = await db.conversationNote.create({
        data: { businessId: req.auth.businessId, conversationId: req.params.id, authorId: req.auth.userId, body },
        include: { author: assignee },
    });
    res.status(201).json({ note });
}));
exports.conversationRoutes.delete("/:id/notes/:noteId", canReply, (0, errors_1.ah)(async (req, res) => {
    const db = await mustFind(req);
    const note = await db.conversationNote.findFirst({ where: { id: req.params.noteId, conversationId: req.params.id } });
    if (!note)
        throw new errors_1.AppError(404, "Note not found");
    const isAdmin = req.auth.role === "OWNER" || req.auth.role === "ADMIN";
    if (note.authorId !== req.auth.userId && !isAdmin)
        throw new errors_1.AppError(403, "You can only delete your own notes");
    await db.conversationNote.deleteMany({ where: { id: note.id } });
    res.status(204).end();
}));
// ---------- rating an AI reply ----------
exports.conversationRoutes.put("/:id/messages/:messageId/feedback", canReply, (0, errors_1.ah)(async (req, res) => {
    const d = zod_1.z.object({ rating: zod_1.z.enum(["up", "down"]).nullable(), note: zod_1.z.string().trim().max(500).optional() }).parse(req.body);
    const db = await mustFind(req);
    const msg = await db.message.findFirst({ where: { id: req.params.messageId, conversationId: req.params.id, sender: "AI" }, select: { id: true } });
    if (!msg)
        throw new errors_1.AppError(404, "AI message not found");
    const message = await db.message.update({
        where: { id: msg.id },
        data: d.rating
            ? { feedback: d.rating, feedbackNote: d.rating === "down" ? d.note ?? null : null, feedbackAt: new Date() }
            : { feedback: null, feedbackNote: null, feedbackAt: null },
    });
    res.json({ message });
}));
