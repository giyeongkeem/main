import type { LLMSettings, Provider } from "./types";

export const DEFAULT_MODELS = {
  claude: "claude-sonnet-4-6",
  openai: "gpt-4o",
} as const;

export interface ResolvedLLM {
  provider: Provider;
  model: string;
  apiKey: string;
}

/**
 * Resolve the effective provider/model/key for a request. Client-supplied
 * settings (from the Settings panel) win; otherwise fall back to env vars so
 * keys can stay server-side if the user prefers.
 */
export function resolveLLM(settings?: Partial<LLMSettings>): ResolvedLLM {
  const provider: Provider = settings?.provider || "claude";
  if (provider === "openai") {
    return {
      provider,
      model: settings?.openaiModel || process.env.OPENAI_MODEL || DEFAULT_MODELS.openai,
      apiKey: settings?.openaiKey || process.env.OPENAI_API_KEY || "",
    };
  }
  return {
    provider,
    model: settings?.claudeModel || process.env.CLAUDE_MODEL || DEFAULT_MODELS.claude,
    apiKey: settings?.claudeKey || process.env.ANTHROPIC_API_KEY || "",
  };
}

export class MissingKeyError extends Error {
  constructor(provider: Provider) {
    super(`${provider} API 키가 없습니다. 설정(⚙️)에서 키를 입력하거나 환경 변수를 설정하세요.`);
    this.name = "MissingKeyError";
  }
}

interface ChatOpts {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export async function chat(llm: ResolvedLLM, opts: ChatOpts): Promise<string> {
  if (!llm.apiKey) throw new MissingKeyError(llm.provider);
  return llm.provider === "openai" ? chatOpenAI(llm, opts) : chatClaude(llm, opts);
}

async function chatClaude(llm: ResolvedLLM, { system, user, maxTokens = 2000, temperature = 0.7 }: ChatOpts) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": llm.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: llm.model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.content?.[0]?.text ?? "").trim();
}

async function chatOpenAI(llm: ResolvedLLM, { system, user, maxTokens = 2000, temperature = 0.7 }: ChatOpts) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${llm.apiKey}`,
    },
    body: JSON.stringify({
      model: llm.model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

/** Parse a JSON object/array out of an LLM response, tolerating code fences. */
export function parseJSON<T>(raw: string): T {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.search(/[[{]/);
  if (start > 0) s = s.slice(start);
  const lastObj = s.lastIndexOf("}");
  const lastArr = s.lastIndexOf("]");
  const end = Math.max(lastObj, lastArr);
  if (end >= 0) s = s.slice(0, end + 1);
  return JSON.parse(s) as T;
}
