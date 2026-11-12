import { Bot, CalendarDays, Inbox, MessageCircle, Users, type LucideIcon } from "lucide-react";

export type VisualKind = "connect" | "knowledge" | "inbox" | "leads" | "booking";

export interface Product {
  slug: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
  headline: string;
  intro: string;
  points: [string, string][];
  note?: { title: string; items: string[] };
  visual: VisualKind;
}

// Every claim here describes something the software really does.
export const PRODUCTS: Product[] = [
  {
    slug: "whatsapp",
    name: "WhatsApp connection",
    tagline: "Link your number with a Facebook sign-in",
    icon: MessageCircle,
    visual: "connect",
    headline: "Connect your WhatsApp number in a couple of minutes.",
    intro: "Use the official WhatsApp Business Platform. Sign in with Facebook, pick your number, confirm a code, and you're connected. We never see your WhatsApp password.",
    points: [
      ["One-click connect", "A guided Facebook window handles the sign-in, your WhatsApp Business account and number verification."],
      ["We set everything up for you", "We check the number, register it and switch on message delivery. If a step fails, you see which one and can retry it with one tap."],
      ["Know your messages arrived", "Messages you and the AI send show sent, delivered and read ticks, and the reason if WhatsApp couldn't deliver one."],
      ["No surprises", "If your connection needs attention or is about to expire, your dashboard tells you before customers are affected."],
    ],
    note: { title: "Good to know", items: [
      "Use a number that isn't currently active in the WhatsApp or WhatsApp Business app.",
      "WhatsApp charges for some business messages under Meta's own pricing, billed by Meta to your WhatsApp Business account.",
      "Add a payment method in WhatsApp Manager after connecting. We remind you.",
    ] },
  },
  {
    slug: "ai",
    name: "AI assistant",
    tagline: "Answers from your information",
    icon: Bot,
    visual: "knowledge",
    headline: "An assistant that knows your business, and knows when to ask a person.",
    intro: "Give it your prices, hours, policies and documents. It replies to customers on WhatsApp in your tone, and hands the chat to your team when it can't help.",
    points: [
      ["Learns from what you give it", "Type in your business details, services and FAQs, or upload PDF, Word, text and Markdown files."],
      ["Prices come from your price list", "It quotes the prices you entered, not guesses. If something isn't in your information, it says it will check and passes the chat to a person."],
      ["Takes real actions", "It can save leads, check your open times, book and cancel appointments, and hand over to your team. Each action is checked by our system first."],
      ["Test it before it talks to customers", "A private test chat uses your real information. It shows what the AI would do without doing it."],
      ["Your tone, your rules", "Choose professional, friendly, casual or short and direct, and add rules such as \"never give discounts\"."],
      ["Replies in your customer's language", "It answers in whichever language the customer writes in."],
    ],
    note: { title: "Good to know", items: [
      "It reads text messages. If someone sends an image or voice note, it asks them to type instead.",
      "Scanned documents (images of text) can't be read yet.",
      "AI can make mistakes. Test it first and review early conversations.",
    ] },
  },
  {
    slug: "inbox",
    name: "Team inbox",
    tagline: "Take over any chat, any time",
    icon: Inbox,
    visual: "inbox",
    headline: "One inbox for your whole team, with the AI on your side.",
    intro: "See every WhatsApp conversation in one place. Jump in when a person is needed, and hand it back when you're done.",
    points: [
      ["Take over in one tap", "The AI stops replying the moment you take over, and can resume when you hand the chat back."],
      ["Assign to a teammate", "Give each conversation an owner and filter by Mine, Unassigned or Needs a person."],
      ["Private notes", "Leave context for your team on any conversation. Customers never see notes."],
      ["Close and reopen", "Keep your inbox tidy. If a customer writes again after a chat is closed, a fresh conversation starts."],
      ["The right access for everyone", "Owner, admin, staff and view-only roles decide who can reply, change settings or just look."],
      ["Reply-window warning", "WhatsApp only allows free-form replies within 24 hours of a customer's last message. We warn you before you send."],
    ],
    note: { title: "Good to know", items: ["The inbox refreshes every few seconds, so new messages appear without reloading."] },
  },
  {
    slug: "customers",
    name: "Leads & customers",
    tagline: "A record for everyone who messages you",
    icon: Users,
    visual: "leads",
    headline: "Every enquiry saved. Every customer remembered.",
    intro: "People who message you become customers automatically. People who show interest become leads you can follow up.",
    points: [
      ["Leads captured for you", "When someone asks about something or shares their name, the AI saves them as a lead with notes for your team."],
      ["Simple lead stages", "Move people through New, Contacted, Qualified, Interested, Won or Lost."],
      ["Customer profiles", "See each person's conversations, leads and appointments together, with tags and private notes."],
      ["Find anyone fast", "Search customers by name, phone number or email."],
    ],
  },
  {
    slug: "bookings",
    name: "Bookings",
    tagline: "Customers book right in the chat",
    icon: CalendarDays,
    visual: "booking",
    headline: "Let customers book without you lifting a finger.",
    intro: "Set the times you're available. The AI offers real open slots, collects the customer's name, and confirms the booking once it's saved.",
    points: [
      ["Your weekly schedule", "Add the start times for each day, how long each slot lasts, and how many bookings a slot can take."],
      ["Only real availability", "The AI can only offer times that are actually open. A time that is taken or invented is rejected by our system."],
      ["Right time, right place", "Times follow your business's time zone, so a customer and your team always see the same slot."],
      ["Stay in control", "See upcoming and past appointments, cancel one, or mark it completed or a no-show. Customers can ask the AI to cancel too."],
    ],
  },
];

export const FAQ: [string, string][] = [
  ["Do I need a new phone number?", "You need a number that isn't currently active in the regular WhatsApp or WhatsApp Business app, because it moves onto WhatsApp's business platform. Many businesses use a dedicated number."],
  ["Will the AI make things up?", "It's instructed to answer only from the information you provide and to hand the conversation to your team when it can't. You can test it before it talks to a real customer and take over any chat at any time. No AI is perfect, so we recommend checking early conversations."],
  ["What languages does it reply in?", "It replies in the language the customer writes in."],
  ["Do I need to be technical?", "No. You connect with a Facebook sign-in and fill in simple forms."],
  ["What does WhatsApp itself cost?", "WhatsApp charges for some business messages under Meta's own pricing, billed by Meta to your WhatsApp Business account. We show you your message and AI usage so there are no surprises."],
  ["Can my team use it too?", "Yes. You can add team members with different roles: admin, staff and view-only."],
  ["Is my customers' data kept private?", "Each business's data is kept separate, WhatsApp access tokens are stored encrypted, and passwords are stored only as hashes. See our Security page for details."],
];

export interface Plan { name: string; price: string; blurb: string; features: string[]; highlight?: boolean }
/** Fill this in when pricing is decided. While it is empty, the pricing page explains what goes into the cost instead. */
export const PLANS: Plan[] = [];
