"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokensUsedToday = tokensUsedToday;
exports.effectiveTokenLimit = effectiveTokenLimit;
exports.checkAiLimits = checkAiLimits;
const env_1 = require("../../config/env");
const prisma_1 = require("../../lib/prisma");
const limits_1 = require("../../lib/limits");
async function tokensUsedToday(businessId) {
    const r = await (0, prisma_1.tenantDb)(businessId).usageRecord.aggregate({
        where: { type: { in: ["AI_INPUT_TOKENS", "AI_OUTPUT_TOKENS"] }, createdAt: { gte: (0, limits_1.startOfUtcDay)() } },
        _sum: { quantity: true },
    });
    return r._sum.quantity ?? 0;
}
async function effectiveTokenLimit(businessId) {
    const b = await prisma_1.prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { dailyAiTokenLimit: true } });
    return b.dailyAiTokenLimit ?? env_1.env.DEFAULT_DAILY_AI_TOKEN_LIMIT;
}
async function checkAiLimits(businessId, conversationId) {
    const db = (0, prisma_1.tenantDb)(businessId);
    const [tokensToday, tokenLimit, repliesLastHour] = await Promise.all([
        tokensUsedToday(businessId),
        effectiveTokenLimit(businessId),
        db.message.count({ where: { conversationId, sender: "AI", createdAt: { gte: new Date(Date.now() - 3600_000) } } }),
    ]);
    return (0, limits_1.evaluateLimits)({ repliesLastHour, tokensToday, replyCap: env_1.env.AI_MAX_REPLIES_PER_CONVERSATION_PER_HOUR, tokenLimit });
}
