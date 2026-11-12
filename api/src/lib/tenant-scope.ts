// Every model that carries a businessId. A test checks this list against schema.prisma, so a new
// tenant model cannot be added without also being listed here.
export const TENANT_MODELS = new Set([
  "TeamMember", "WhatsappAccount", "Customer", "Conversation", "Message", "Lead", "ConversationNote", "Service",
  "AvailabilityRule", "Appointment", "KnowledgeGap", "AiAgent", "KnowledgeDocument", "KnowledgeChunk", "UsageRecord", "AuditLog",
]);

/**
 * Forces `businessId` onto a Prisma query for tenant models. The scoped value is applied last, so a
 * caller (or a bug) that supplies a different businessId is overwritten, never obeyed. Any operation
 * not handled here is rejected rather than allowed through unscoped.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scopeArgs(model: string, operation: string, args: any, businessId: string): any {
  if (!TENANT_MODELS.has(model)) return args;
  const a = { ...(args ?? {}) };
  switch (operation) {
    case "findMany": case "findFirst": case "findFirstOrThrow": case "count": case "aggregate": case "groupBy":
    case "updateMany": case "deleteMany":
      a.where = { ...(a.where ?? {}), businessId };
      break;
    case "findUnique": case "findUniqueOrThrow": case "update": case "delete":
      a.where = { ...(a.where ?? {}), businessId };
      break;
    case "upsert":
      a.where = { ...(a.where ?? {}), businessId };
      a.create = { ...(a.create ?? {}), businessId };
      break;
    case "create":
      a.data = { ...(a.data ?? {}), businessId };
      break;
    case "createMany":
      a.data = (Array.isArray(a.data) ? a.data : [a.data]).map((d: object) => ({ ...d, businessId }));
      break;
    default:
      throw new Error(`Operation ${operation} is not allowed on tenant data`);
  }
  return a;
}
