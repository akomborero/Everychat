export type Role = "OWNER" | "ADMIN" | "STAFF" | "VIEWER";
export type ConversationStatus = "OPEN" | "NEEDS_HUMAN" | "CLOSED";
export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "INTERESTED" | "WON" | "LOST";
export type Tone = "professional" | "friendly" | "casual" | "direct";

export interface Me {
  user: { id: string; name: string; email: string };
  business: { id: string; name: string; industry: string | null; timezone: string };
  role: Role;
  emailVerified: boolean;
  platformAdmin: boolean;
  notifyNeedsHuman: boolean;
}

export interface Customer { id: string; name: string | null; phone: string; email: string | null }
export interface Message {
  id: string;
  sender: "CUSTOMER" | "AI" | "STAFF" | "SYSTEM";
  body: string;
  messageType: string;
  deliveryStatus: "sent" | "delivered" | "read" | "failed" | null;
  deliveryError: string | null;
  feedback?: "up" | "down" | null;
  feedbackNote?: string | null;
  createdAt: string;
}
export interface Note { id: string; body: string; createdAt: string; author: { id: string; name: string } | null }
export interface Conversation {
  id: string;
  status: ConversationStatus;
  aiEnabled: boolean;
  lastMessageAt: string;
  customer: Customer;
  assignedTo?: { id: string; name: string } | null;
  whatsappAccount?: { displayPhone: string } | null;
  messages?: Message[];
}
export interface Lead {
  id: string;
  status: LeadStatus;
  interest: string | null;
  notes: string | null;
  source: string;
  updatedAt: string;
  customer: Customer;
}
export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  active: boolean;
}
export interface KnowledgeDoc {
  id: string;
  name: string;
  kind: "UPLOAD" | "FAQ" | "NOTE";
  status: "processing" | "ready" | "failed";
  error: string | null;
  createdAt: string;
}
export interface Agent { id: string; name: string; tone: Tone; instructions: string; rules: string[]; active: boolean }
export interface BusinessProfile {
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  address: string | null;
  openingHours: string | null;
  timezone: string;
}
export interface WhatsappAccount {
  id: string;
  displayPhone: string;
  verifiedName: string | null;
  phoneNumberId: string;
  businessAccountId: string;
  status: "ACTIVE" | "DISCONNECTED";
  registered: boolean;
  webhookSubscribed: boolean;
  tokenExpiresAt: string | null;
  setupError: string | null;
  createdAt: string;
}
export type AppointmentStatus = "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
export interface AvailabilityRule { id?: string; dayOfWeek: number; startTime: string; durationMin: number; capacity: number }
export interface Appointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  notes: string | null;
  source: string;
  customer: { name: string | null; phone: string };
  service: { name: string } | null;
}
export interface Overview {
  conversations: number;
  needsHuman: number;
  leads7d: number;
  leadsTotal: number;
  customers: number;
  aiShare: number | null;
  daily: { date: string; customer: number; ai: number; staff: number }[];
  setup: { whatsappConnected: boolean; profile: boolean; services: boolean; knowledge: boolean; aiActive: boolean; availability: boolean };
  upcoming: Appointment[];
  whatsappAttention: boolean;
  aiLimitReached: boolean;
  openGaps: number;
}

export interface CustomerFull extends Customer {
  tags: string[];
  notes: string | null;
  createdAt: string;
}
export interface CustomerListItem extends CustomerFull { _count: { leads: number; appointments: number; conversations: number } }
export interface CustomerDetail extends CustomerFull {
  leads: Lead[];
  appointments: Appointment[];
  conversations: { id: string; status: ConversationStatus; lastMessageAt: string }[];
}
export interface TeamMember { id: string; role: Role; createdAt: string; user: { id: string; name: string; email: string } }
export interface Usage { days: number; whatsappInbound: number; whatsappOutbound: number; aiInputTokens: number; aiOutputTokens: number }

export interface AdminOverview {
  businesses: number; users: number; conversations: number; messages30d: number;
  whatsappNumbers: number; aiLive: number; aiTokens30d: number; aiFailures24h: number;
  signupsByDay: { date: string; count: number }[];
}
export interface AdminBusiness {
  id: string; name: string; industry: string | null; createdAt: string;
  owner: { name: string; email: string } | null;
  members: number; customers: number; conversations: number;
  whatsappConnected: boolean; aiActive: boolean; messages30d: number; aiTokens30d: number; dailyAiTokenLimit: number | null;
}

export interface Analytics {
  days: number;
  timezone: string;
  totals: {
    conversations: number; newCustomers: number; customerMessages: number; aiReplies: number; staffReplies: number;
    leads: number; leadsWon: number; appointments: number; appointmentsByAi: number;
    appointmentsCompleted: number; appointmentsNoShow: number; appointmentsCancelled: number;
  };
  rates: { aiResolvedShare: number | null; handedToPeopleShare: number | null; leadsPerConversation: number | null; winRate: number | null };
  firstResponse: { medianSeconds: number | null; sample: number };
  handoffs: { requested: number; failed: number; unanswered: number; limitReached: number };
  feedback: { up: number; down: number };
  topInterests: { value: string; count: number }[];
  daily: { date: string; conversations: number; customer: number; ai: number; staff: number }[];
}
export interface FeedbackItem { messageId: string; conversationId: string; customerMessage: string | null; aiReply: string; note: string | null; ratedAt: string | null }
export interface AuditEntry { id: string; action: string; createdAt: string; actor: string | null; metadata: Record<string, unknown> | null }
export interface GapGroup { key: string; question: string; count: number; ids: string[]; lastAt: string }
