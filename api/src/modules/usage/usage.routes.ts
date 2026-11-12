import { Router } from "express";
import { z } from "zod";
import { tenantDb } from "../../lib/prisma";
import { ah } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";

export const usageRoutes = Router();
usageRoutes.use(requireAuth);

usageRoutes.get(
  "/",
  ah(async (req, res) => {
    const days = z.coerce.number().int().min(1).max(90).default(30).parse(req.query.days ?? 30);
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const db = tenantDb(req.auth!.businessId);
    const sum = async (type: "WHATSAPP_INBOUND" | "WHATSAPP_OUTBOUND" | "AI_INPUT_TOKENS" | "AI_OUTPUT_TOKENS") =>
      (await db.usageRecord.aggregate({ where: { type, createdAt: { gte: since } }, _sum: { quantity: true } }))._sum.quantity ?? 0;

    const [whatsappInbound, whatsappOutbound, aiInputTokens, aiOutputTokens] = await Promise.all([
      sum("WHATSAPP_INBOUND"), sum("WHATSAPP_OUTBOUND"), sum("AI_INPUT_TOKENS"), sum("AI_OUTPUT_TOKENS"),
    ]);
    res.json({ days, whatsappInbound, whatsappOutbound, aiInputTokens, aiOutputTokens });
  }),
);
