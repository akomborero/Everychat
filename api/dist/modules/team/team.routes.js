"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.teamRoutes = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const auth_1 = require("../../middleware/auth");
exports.teamRoutes = (0, express_1.Router)();
exports.teamRoutes.use(auth_1.requireAuth);
const ASSIGNABLE = zod_1.z.enum(["ADMIN", "STAFF", "VIEWER"]);
// Only the owner may create, change or remove admins. Admins manage staff and viewers.
function assertCanManage(actorRole, targetRole) {
    if (targetRole === "OWNER")
        throw new errors_1.AppError(403, "The owner cannot be changed or removed");
    if ((targetRole === "ADMIN") && actorRole !== "OWNER")
        throw new errors_1.AppError(403, "Only the owner can manage admins");
}
exports.teamRoutes.get("/", (0, errors_1.ah)(async (req, res) => {
    const members = await (0, prisma_1.tenantDb)(req.auth.businessId).teamMember.findMany({
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json({ members, currentUserId: req.auth.userId });
}));
// No email service yet, so the owner or admin sets a first password and shares it. The person can change it in Settings.
exports.teamRoutes.post("/", (0, auth_1.requireRole)("OWNER", "ADMIN"), (0, errors_1.ah)(async (req, res) => {
    const { businessId, role: actorRole, userId } = req.auth;
    const d = zod_1.z
        .object({
        name: zod_1.z.string().trim().min(1).max(100),
        email: zod_1.z.string().trim().toLowerCase().email(),
        role: ASSIGNABLE,
        password: zod_1.z.string().min(8).max(100),
    })
        .parse(req.body);
    assertCanManage(actorRole, d.role);
    try {
        const passwordHash = await bcryptjs_1.default.hash(d.password, 12);
        const member = await prisma_1.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({ data: { name: d.name, email: d.email, passwordHash } });
            return tx.teamMember.create({ data: { businessId, userId: user.id, role: d.role }, include: { user: { select: { id: true, name: true, email: true } } } });
        });
        await (0, prisma_1.tenantDb)(businessId).auditLog.create({ data: { businessId, userId, action: "team.added", metadata: { email: d.email, role: d.role } } });
        res.status(201).json({ member });
    }
    catch (e) {
        if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            throw new errors_1.AppError(409, "That email already has an account. Each person can belong to one business for now.");
        }
        throw e;
    }
}));
exports.teamRoutes.patch("/:id", (0, auth_1.requireRole)("OWNER", "ADMIN"), (0, errors_1.ah)(async (req, res) => {
    const { businessId, role: actorRole, userId } = req.auth;
    const { role } = zod_1.z.object({ role: ASSIGNABLE }).parse(req.body);
    const db = (0, prisma_1.tenantDb)(businessId);
    const target = await db.teamMember.findFirst({ where: { id: req.params.id } });
    if (!target)
        throw new errors_1.AppError(404, "Team member not found");
    if (target.userId === userId)
        throw new errors_1.AppError(400, "You can't change your own role");
    assertCanManage(actorRole, target.role);
    assertCanManage(actorRole, role);
    const member = await db.teamMember.update({
        where: { id: target.id },
        data: { role },
        include: { user: { select: { id: true, name: true, email: true } } },
    });
    await db.auditLog.create({ data: { businessId, userId, action: "team.role_changed", metadata: { memberId: target.id, role } } });
    res.json({ member });
}));
exports.teamRoutes.delete("/:id", (0, auth_1.requireRole)("OWNER", "ADMIN"), (0, errors_1.ah)(async (req, res) => {
    const { businessId, role: actorRole, userId } = req.auth;
    const db = (0, prisma_1.tenantDb)(businessId);
    const target = await db.teamMember.findFirst({ where: { id: req.params.id } });
    if (!target)
        throw new errors_1.AppError(404, "Team member not found");
    if (target.userId === userId)
        throw new errors_1.AppError(400, "You can't remove yourself");
    assertCanManage(actorRole, target.role);
    await db.teamMember.deleteMany({ where: { id: target.id } });
    await db.auditLog.create({ data: { businessId, userId, action: "team.removed", metadata: { memberId: target.id } } });
    res.status(204).end();
}));
