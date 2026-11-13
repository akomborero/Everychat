// Brand name used across the app. Change it here and in index.html.
export const BRAND_NAME = "Everychat";
// Shown on the public pages and in the legal documents. Set these in apps/web/.env before launch.
export const COMPANY_NAME: string = import.meta.env.VITE_COMPANY_NAME || BRAND_NAME;
export const CONTACT_EMAIL: string = import.meta.env.VITE_CONTACT_EMAIL || "";
/** Stays false until a lawyer has reviewed the legal text; the pages show a warning until then. */
export const LEGAL_REVIEWED: boolean = import.meta.env.VITE_LEGAL_REVIEWED === "true";
export const LEGAL_UPDATED = "8 October 2026";
export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
