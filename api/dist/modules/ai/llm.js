"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.llm = void 0;
const env_1 = require("../../config/env");
class OpenAiProvider {
    async post(path, body) {
        const res = await fetch(`https://api.openai.com/v1${path}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${env_1.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok)
            throw new Error(`OpenAI ${res.status}: ${json?.error?.message ?? "request failed"}`);
        return json;
    }
    async chat({ messages, tools }) {
        const json = await this.post("/chat/completions", {
            model: env_1.env.OPENAI_CHAT_MODEL,
            messages,
            tools: tools?.length ? tools.map((t) => ({ type: "function", function: t })) : undefined,
        });
        const msg = json.choices?.[0]?.message;
        return {
            content: msg?.content ?? null,
            toolCalls: (msg?.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, arguments: c.function.arguments })),
            usage: { input: json.usage?.prompt_tokens ?? 0, output: json.usage?.completion_tokens ?? 0 },
        };
    }
    async embed(texts) {
        const json = await this.post("/embeddings", { model: env_1.env.OPENAI_EMBEDDING_MODEL, input: texts });
        const vectors = json.data
            .sort((a, b) => a.index - b.index)
            .map((d) => d.embedding);
        return { vectors, tokens: json.usage?.total_tokens ?? 0 };
    }
}
exports.llm = new OpenAiProvider();
