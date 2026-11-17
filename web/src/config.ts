// Brand name used across the app. Change it here and in index.html.
export const BRAND_NAME = "Everychat";
// Shown on the public pages and in the legal documents. Set these in apps/web/.env before launch.
export const COMPANY_NAME: string = import.meta.env.VITE_COMPANY_NAME || BRAND_NAME;
export const CONTACT_EMAIL: string = import.meta.env.VITE_CONTACT_EMAIL || "";
/** Stays false until a lawyer has reviewed the legal text; the pages show a warning until then. */
export const LEGAL_REVIEWED: boolean = import.meta.env.VITE_LEGAL_REVIEWED === "true";
export const LEGAL_UPDATED = "8 October 2026";
/**
 * Production goes through the same-origin `/api` rewrite on the Render static site, so the session
 * cookie stays first-party. Locally the Vite dev server still talks to the API on localhost:4000.
 * An explicit VITE_API_URL (e.g. an HTTPS tunnel during development) always wins.
 */
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) || (import.meta.env.DEV ? "http://localhost:4000" : "/api");
