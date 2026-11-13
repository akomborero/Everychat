"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flagForHuman = flagForHuman;
const email_1 = require("../../lib/email");
const logger_1 = require("../../lib/logger");
const events_1 = require("../../lib/events");
const prisma_1 = require("../../lib/prisma");
const WHY = {
    requested: "The AI passed this conversation to your team.",
    limit: "The AI reached its usage limit, so a person needs to answer.",
    failed: "The AI couldn't reply to the latest message.",
    unanswered: "The latest message waited too long for the AI to answer.",
};
// One email per person per couple of minutes, so a burst of handovers doesn't flood an inbox. The dashboard still shows all of them.
const lastEmailed = new Map();
const MIN_GAP_MS = 2 * 60_000;
/**
 * Moves an open conversation to "Needs a person", stops the AI, and emails the right people once.
 * Returns false if it was already waiting for a person or is closed, so the same event never sends two emails.
 */
async function flagForHuman(businessId, conversationId, reason) {
    const db = (0, prisma_1.tenantDb)(businessId);
    const { count } = await db.conversation.updateMany({ where: { id: conversationId, status: "OPEN" }, data: { status: "NEEDS_HUMAN", aiEnabled: false } });
    if (count !== 1)
        return false;
    (0, events_1.publishChange)(businessId);
    void notifyTeam(businessId, conversationId, reason).catch((e) => (0, logger_1.logError)("Needs-a-person email failed", e, { businessId, conversationId }));
    return true;
}
async function notifyTeam(businessId, conversationId, reason) {
    const db = (0, prisma_1.tenantDb)(businessId);
    const convo = await db.conversation.findFirst({
        where: { id: conversationId },
        include: { customer: true, assignedTo: { select: { id: true, email: true, notifyNeedsHuman: true } } },
    });
    if (!convo)
        return;
    const business = await prisma_1.prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { name: true } });
    // If someone owns the conversation, tell them. Otherwise tell the owner and admins.
    let recipients;
    if (convo.assignedTo) {
        recipients = convo.assignedTo.notifyNeedsHuman ? [convo.assignedTo] : [];
    }
    else {
        const members = await db.teamMember.findMany({
            where: { role: { in: ["OWNER", "ADMIN"] } },
            include: { user: { select: { id: true, email: true, notifyNeedsHuman: true } } },
        });
        recipients = members.map((m) => m.user).filter((u) => u.notifyNeedsHuman);
    }
    const mail = (0, email_1.needsHumanEmail)({ business: business.name, who: convo.customer.name || convo.customer.phone, why: WHY[reason], link: `${(0, email_1.appUrl)()}/inbox/${conversationId}` });
    for (const r of recipients) {
        if (Date.now() - (lastEmailed.get(r.id) ?? 0) < MIN_GAP_MS)
            continue;
        lastEmailed.set(r.id, Date.now());
        await (0, email_1.sendEmail)({ to: r.email, ...mail });
    }
}
