import { env } from "../../config/env";
import { prisma, tenantDb } from "../../lib/prisma";
import { evaluateLimits, startOfUtcDay, type LimitVerdict } from "../../lib/limits";

export async function tokensUsedToday(businessId: string): Promise<number> {
  const r = await tenantDb(businessId).usageRecord.aggregate({
    where: { type: { in: ["AI_INPUT_TOKENS", "AI_OUTPUT_TOKENS"] }, createdAt: { gte: startOfUtcDay() } },
    _sum: { quantity: true },
  });
  return r._sum.quantity ?? 0;
}

export async function effectiveTokenLimit(businessId: string): Promise<number> {
  const b = await prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { dailyAiTokenLimit: true } });
  return b.dailyAiTokenLimit ?? env.DEFAULT_DAILY_AI_TOKEN_LIMIT;
}

export async function checkAiLimits(businessId: string, conversationId: string): Promise<LimitVerdict> {
  const db = tenantDb(businessId);
  const [tokensToday, tokenLimit, repliesLastHour] = await Promise.all([
    tokensUsedToday(businessId),
    effectiveTokenLimit(businessId),
    db.message.count({ where: { conversationId, sender: "AI", createdAt: { gte: new Date(Date.now() - 3600_000) } } }),
  ]);
  return evaluateLimits({ repliesLastHour, tokensToday, replyCap: env.AI_MAX_REPLIES_PER_CONVERSATION_PER_HOUR, tokenLimit });
}
