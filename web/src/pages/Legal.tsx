import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { PublicLayout } from "../components/PublicLayout";
import { BRAND_NAME, COMPANY_NAME, CONTACT_EMAIL, LEGAL_REVIEWED, LEGAL_UPDATED } from "../config";
import { usePageTitle } from "../lib/hooks";

/*
 * DRAFT legal text written to match what this software actually does. It is not legal advice.
 * A lawyer must review it for your country before launch. Text in [square brackets] needs your decision.
 * Update the list of service providers below if you change the stack.
 */

const Email = () => CONTACT_EMAIL
  ? <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-violet hover:underline">{CONTACT_EMAIL}</a>
  : <span className="rounded bg-red-s px-1.5 font-semibold text-red">[set VITE_CONTACT_EMAIL]</span>;

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  usePageTitle(title);
  return (
    <PublicLayout>
      <article className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-4xl font-extrabold">{title}</h1>
        <p className="mt-2 text-muted">Last updated {LEGAL_UPDATED}</p>
        {!LEGAL_REVIEWED && (
          <div role="note" className="mt-6 flex gap-3 rounded-2xl bg-amber-s p-4 text-sm">
            <AlertTriangle size={20} className="mt-0.5 flex-none" />
            <div><b>Draft, not yet reviewed by a lawyer.</b> This text was written to match how the software works, but it is not legal advice. Have it reviewed for your country, fill in anything in [square brackets], then set <code>VITE_LEGAL_REVIEWED=true</code> to remove this notice.</div>
          </div>
        )}
        <div className="mt-8 space-y-4 leading-relaxed [&_a]:font-semibold [&_a]:text-violet [&_a:hover]:underline [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">{children}</div>
      </article>
    </PublicLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>{COMPANY_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) runs {BRAND_NAME}, a service that lets businesses connect their WhatsApp number and use AI to answer customers, capture leads and manage bookings. This policy explains what personal data we handle and why. Questions: <Email />.</p>

      <h2>Two roles, and why they matter</h2>
      <ul>
        <li><b>Your account and business details.</b> If you sign up, we decide how this data is used, so we are the controller.</li>
        <li><b>Your customers&rsquo; data.</b> When a business uses {BRAND_NAME} to talk to its customers, the business decides why and how that data is used, and we process it on the business&rsquo;s behalf. If you are a customer of a business that uses {BRAND_NAME}, please contact that business first about your data. You can also contact us and we will pass your request on.</li>
      </ul>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account and business information:</b> your name, email, phone number, password (stored only as a one-way hash), business name, type, description, address, opening hours, time zone, services and prices, and your team members&rsquo; names, emails and roles.</li>
        <li><b>Customer conversations processed for a business:</b> the customer&rsquo;s WhatsApp phone number and profile name, message text, when messages were sent, whether they were delivered or read, and records the business and the AI create from them: customers, leads, appointments, tags, internal notes and conversation assignments.</li>
        <li><b>Images, audio and files</b> that customers send are not downloaded or stored. We record only that a message of that type arrived.</li>
        <li><b>Documents a business uploads:</b> we extract and store the text, and search it to help the AI answer.</li>
        <li><b>WhatsApp connection details:</b> the phone number ID, WhatsApp account ID and an access token that Meta issues when a business connects. The token is stored encrypted. We never receive your WhatsApp password.</li>
        <li><b>Usage data:</b> counts of messages and AI usage per business.</li>
        <li><b>Technical data:</b> IP address, browser type and request logs, used to keep the service secure and working. We do not use advertising or analytics trackers.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To provide the service: connect WhatsApp, receive and send messages, generate AI replies, save leads and bookings, and show everything in the dashboard.</li>
        <li>To secure accounts, prevent abuse and fix problems.</li>
        <li>To send account emails such as password resets and email confirmation.</li>
        <li>To meet legal obligations and respond to lawful requests.</li>
      </ul>
      <p>We do not sell personal data, and we do not use it for advertising.</p>

      <h2>How the AI uses data</h2>
      <p>To write a reply, we send an AI provider the recent messages of that conversation, the business&rsquo;s information and prices, the customer&rsquo;s upcoming appointments, and short passages from the business&rsquo;s uploaded documents that match the question. We send only what is needed for that reply. Each business&rsquo;s data is kept separate and is never used to answer another business&rsquo;s customers. How the provider handles data is described in its own terms: [confirm your AI provider&rsquo;s data-use and retention terms and summarise them here].</p>

      <h2>Who we share data with</h2>
      <p>We use service providers to run {BRAND_NAME}. They process data only to provide their service to us:</p>
      <ul>
        <li><b>Meta Platforms</b>: the WhatsApp Business Platform that delivers messages and connects numbers.</li>
        <li><b>OpenAI</b>: AI processing to generate replies and search documents.</li>
        <li><b>Neon</b>: database hosting.</li>
        <li><b>Render and Vercel</b>: application hosting.</li>
        <li><b>Resend</b>: sending account emails.</li>
        <li><b>Sentry</b> [include only if you enable error monitoring]: receives technical error details and internal ids so we can fix problems. We do not send message text to it.</li>
      </ul>
      <p>We may also disclose data when the law requires it, to protect people&rsquo;s safety or our rights, or in a merger or sale of the business, in which case we will tell you. We will update this list if our providers change.</p>

      <h2>International transfers</h2>
      <p>Our providers may process data in countries other than yours. Where the law requires, we rely on appropriate safeguards for these transfers. [Add details for your jurisdiction.]</p>

      <h2>How long we keep data</h2>
      <p>We keep account and business data while the account is open. Conversation data stays until the business deletes it or closes its account. After an account is closed, or after a valid deletion request, we delete or anonymise the data within [30 days], except where we must keep something to meet a legal obligation. Backups may take a little longer to clear.</p>

      <h2>Security</h2>
      <p>We use HTTPS for data in transit, store WhatsApp access tokens encrypted, store passwords only as hashes, keep each business&rsquo;s data separate, and limit access by role. Signing in again is required after a password reset. No system is perfectly secure, so please use a strong, unique password.</p>

      <h2>Your rights</h2>
      <p>Depending on where you live, you may have the right to access, correct or delete your personal data, to object to or restrict some uses, and to receive a copy. Business owners can export and delete their data in the app under Settings, then Data. To use these rights in other ways, email <Email />. See <Link to="/data-deletion">how to delete your data</Link>. You can also complain to your local data protection authority.</p>

      <h2>Cookies</h2>
      <p>We use one essential cookie to keep you signed in. It is marked HttpOnly, so scripts on the page cannot read it, and it expires after seven days. We do not use advertising or analytics cookies. On the screen where you connect WhatsApp, Meta&rsquo;s own script loads from Facebook, which is covered by Meta&rsquo;s policies.</p>

      <h2>Children</h2>
      <p>{BRAND_NAME} is for businesses and is not directed at anyone under [18]. We do not knowingly collect their data for our own purposes.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a meaningful way, we will update the date above and, where appropriate, notify you.</p>

      <h2>Contact</h2>
      <p>{COMPANY_NAME}. Email: <Email />. [Add your postal address and, if required, your data protection contact.]</p>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p>These terms are an agreement between you and {COMPANY_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) about your use of {BRAND_NAME}. By creating an account or using the service you agree to them. If you use it for a business, you confirm you can bind that business.</p>

      <h2>The service</h2>
      <p>{BRAND_NAME} lets you connect a WhatsApp Business number and use AI to answer customers, capture leads, book appointments and manage conversations with your team. Features may change over time.</p>

      <h2>Your account</h2>
      <ul>
        <li>Give accurate information and keep your password secure. You are responsible for activity under your account and for the people you add to your team.</li>
        <li>You must be at least [18] years old.</li>
        <li>Tell us promptly if you suspect unauthorised access.</li>
      </ul>

      <h2>WhatsApp and Meta</h2>
      <p>The service relies on the WhatsApp Business Platform. You must follow Meta&rsquo;s terms and policies, including the WhatsApp Business Terms and Commerce Policy. Meta sets its own rules and prices, including fees for some business messages, which Meta bills to you directly. Meta may limit, suspend or end access to WhatsApp, and we are not responsible for Meta&rsquo;s decisions or charges.</p>

      <h2>Acceptable use</h2>
      <p>You agree not to use the service to:</p>
      <ul>
        <li>send spam, or message people who have not agreed to hear from you where consent is required;</li>
        <li>break the law, or send fraudulent, deceptive, harassing, hateful or sexually explicit content;</li>
        <li>handle categories of data or content that WhatsApp or the law prohibits;</li>
        <li>attempt to access other businesses&rsquo; data, interfere with the service, or reverse engineer it;</li>
        <li>use the AI to give advice you are not qualified or permitted to give.</li>
      </ul>

      <h2>Your customers and your data</h2>
      <ul>
        <li>You are responsible for having a lawful basis to message your customers and process their data, for any notices you must give them, and for telling them where required that an automated assistant may be replying.</li>
        <li>You keep ownership of your content and customer data. You give us permission to process it only to provide the service, as described in our <Link to="/privacy">Privacy Policy</Link>.</li>
      </ul>

      <h2>About the AI</h2>
      <p>The AI generates replies automatically and can make mistakes, misunderstand a message, or give an incomplete answer. You are responsible for the information, prices and rules you give it, for testing it, for reviewing its conversations, and for the consequences of using it. You can take over any conversation and switch the AI off at any time. Do not rely on it for legal, medical, financial or safety-critical decisions.</p>

      <h2>Fees</h2>
      <p>[Describe your plans, prices, billing cycle and refund terms here.] Any fees will be shown to you before you are charged.</p>

      <h2>Availability</h2>
      <p>We work to keep the service running but do not promise it will always be available or error-free. It depends on third parties such as Meta and our AI provider. We may carry out maintenance and change or remove features.</p>

      <h2>Suspension and ending</h2>
      <p>You can stop using the service and close your account at any time. We may suspend or end access, including switching off the AI for your business, if you break these terms, put others at risk, or if Meta or the law requires it. We will give notice where we reasonably can.</p>

      <h2>Our rights</h2>
      <p>We own the service, its software and design. These terms give you a limited, non-exclusive right to use it, not ownership of any of it.</p>

      <h2>Liability</h2>
      <p>The service is provided &ldquo;as is&rdquo;. To the extent the law allows, we are not liable for indirect or consequential losses, lost profits or lost business, and our total liability for any claim is limited to [the fees you paid us in the 12 months before the claim]. Nothing in these terms limits liability that cannot be limited by law.</p>

      <h2>Changes and law</h2>
      <p>We may update these terms and will tell you about significant changes. Continuing to use the service means you accept them. These terms are governed by the laws of [country or region], and disputes will be handled by its courts, unless the law of your country says otherwise.</p>

      <h2>Contact</h2>
      <p>{COMPANY_NAME}. Email: <Email />.</p>
    </LegalLayout>
  );
}

export function DataDeletionPage() {
  return (
    <LegalLayout title="Delete your data">
      <p>You can ask us to delete your data from {BRAND_NAME} at any time. This page explains how.</p>

      <h2>Delete it yourself</h2>
      <p>Business owners can delete the whole business, including every customer and conversation, under Settings, then Data. Owners and admins can also export or permanently delete one customer under Customers. These take effect immediately.</p>

      <h2>Or ask us to do it</h2>
      <ol className="list-decimal space-y-1.5 pl-6">
        <li>Email <Email /> from the address on your account, with the subject &ldquo;Delete my data&rdquo;.</li>
        <li>Say whether you want your whole account and business deleted, or only certain customers&rsquo; conversations.</li>
        <li>We may ask you to confirm your identity so that nobody else can delete your data.</li>
        <li>We delete the data within [30 days] and confirm by email. Some information may remain briefly in backups, or where the law requires us to keep it.</li>
      </ol>

      <h2>If you are a customer of a business that uses {BRAND_NAME}</h2>
      <p>The business decides how your messages are used, so please ask that business to delete them. You can also email <Email /> with the WhatsApp number you used and the business you wrote to, and we will pass your request on or act on it where we can.</p>

      <h2>If you signed in with Facebook to connect a WhatsApp number</h2>
      <p>You can remove our access to your Facebook account at any time in your Facebook account settings, under the business integrations or apps you have connected. To have us delete the data we hold, follow the steps above. Information held by Meta or WhatsApp is under their control and handled under their policies.</p>

      <p>See also our <Link to="/privacy">Privacy Policy</Link>.</p>
    </LegalLayout>
  );
}
