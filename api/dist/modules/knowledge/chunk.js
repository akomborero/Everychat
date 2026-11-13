"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunkText = chunkText;
/** Splits text into roughly size-character chunks along paragraph boundaries. */
function chunkText(text, size = 900, overlap = 150) {
    const clean = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (!clean)
        return [];
    const chunks = [];
    let cur = "";
    const flush = () => {
        if (cur.trim())
            chunks.push(cur.trim());
        cur = "";
    };
    for (const para of clean.split(/\n\n+/)) {
        if (cur && cur.length + 2 + para.length <= size) {
            cur += "\n\n" + para;
            continue;
        }
        flush();
        if (para.length <= size) {
            cur = para;
        }
        else {
            // A single huge paragraph: slice it with overlap so no sentence loses its context.
            for (let i = 0; i < para.length; i += size - overlap) {
                chunks.push(para.slice(i, i + size).trim());
                if (i + size >= para.length)
                    break;
            }
        }
    }
    flush();
    return chunks.filter(Boolean);
}
