import { env } from "../../config/env";

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatResult {
  content: string | null;
  toolCalls: { id: string; name: string; arguments: string }[];
  usage: { input: number; output: number };
}

/** The rest of the app talks to this interface only, so the provider can be swapped. */
export interface LlmProvider {
  chat(opts: { messages: ChatMessage[]; tools?: ToolDef[] }): Promise<ChatResult>;
  embed(texts: string[]): Promise<{ vectors: number[][]; tokens: number }>;
}

class OpenAiProvider implements LlmProvider {
  private async post(path: string, body: unknown): Promise<any> {
    const res = await fetch(`https://api.openai.com/v1${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${json?.error?.message ?? "request failed"}`);
    return json;
  }

  async chat({ messages, tools }: { messages: ChatMessage[]; tools?: ToolDef[] }): Promise<ChatResult> {
    const json = await this.post("/chat/completions", {
      model: env.OPENAI_CHAT_MODEL,
      messages,
      tools: tools?.length ? tools.map((t) => ({ type: "function", function: t })) : undefined,
    });
    const msg = json.choices?.[0]?.message;
    return {
      content: msg?.content ?? null,
      toolCalls: (msg?.tool_calls ?? []).map((c: any) => ({ id: c.id, name: c.function.name, arguments: c.function.arguments })),
      usage: { input: json.usage?.prompt_tokens ?? 0, output: json.usage?.completion_tokens ?? 0 },
    };
  }

  async embed(texts: string[]) {
    const json = await this.post("/embeddings", { model: env.OPENAI_EMBEDDING_MODEL, input: texts });
    const vectors = (json.data as { index: number; embedding: number[] }[])
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
    return { vectors, tokens: json.usage?.total_tokens ?? 0 };
  }
}

export const llm: LlmProvider = new OpenAiProvider();
