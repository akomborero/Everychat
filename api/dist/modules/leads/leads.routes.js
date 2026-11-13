"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../../lib/prisma");
const errors_1 = require("../../lib/errors");
const auth_1 = require("../../middleware/auth");
exports.leadRoutes = (0, express_1.Router)();
exports.leadRoutes.use(auth_1.requireAuth);
const STATUS = zod_1.z.enum(["NEW", "CONTACTED", "QUALIFIED", "INTERESTED", "WON", "LOST"]);
exports.leadRoutes.get("/", (0, errors_1.ah)(async (req, res) => {
    const status = STATUS.optional().parse(req.query.status);
    const leads = await (0, prisma_1.tenantDb)(req.auth.businessId).lead.findMany({
        where: status ? { status } : {},
        orderBy: { updatedAt: "desc" },
        take: 200,
        include: { customer: true },
    });
    res.json({ leads });
}));
exports.leadRoutes.patch("/:id", (0, auth_1.requireRole)("OWNER", "ADMIN", "STAFF"), (0, errors_1.ah)(async (req, res) => {
    const db = (0, prisma_1.tenantDb)(req.auth.businessId);
    const d = zod_1.z
        .object({ status: STATUS, interest: zod_1.z.string().trim().max(200).nullable(), notes: zod_1.z.string().trim().max(2000).nullable() })
        .partial()
        .parse(req.body);
    if (!(await db.lead.findFirst({ where: { id: req.params.id }, select: { id: true } })))
        throw new errors_1.AppError(404, "Lead not found");
    const lead = await db.lead.update({ where: { id: req.params.id }, data: d, include: { customer: true } });
    res.json({ lead });
}));
