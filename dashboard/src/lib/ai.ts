import { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ───

export type AIProvider = "gemini" | "anthropic" | "moonshot" | "openai";

export type AIModel = {
  id: string;
  label: string;
  provider: AIProvider;
};

export type AICallOptions = {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  signal?: AbortSignal;
};

// ─── Model registry ───

const MODEL_MAP: Record<string, AIProvider> = {
  "gemini-2.5-flash": "gemini",
  "gemini-2.5-pro": "gemini",
  "gemini-3-flash-preview": "gemini",
  "gemini-3.1-pro-preview": "gemini",
  "claude-sonnet-4-5-20250929": "anthropic",
  "claude-haiku-4-5-20251001": "anthropic",
  "claude-opus-4-6": "anthropic",
  "kimi-k2.5": "moonshot",
  "gpt-4o": "openai",
};

const ALL_MODELS: AIModel[] = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash (Preview)", provider: "gemini" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (Preview)", provider: "gemini" },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", provider: "anthropic" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic" },
  { id: "kimi-k2.5", label: "Kimi K2.5", provider: "moonshot" },
  { id: "gpt-4o", label: "GPT-4o", provider: "openai" },
];

const PROVIDER_ENV: Record<AIProvider, string> = {
  gemini: "GEMINI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  moonshot: "MOONSHOT_API_KEY",
  openai: "OPENAI_API_KEY",
};

const DEFAULT_MODEL = "gemini-2.5-flash";

// ─── Provider helpers ───

function getProviderForModel(model: string): AIProvider {
  const provider = MODEL_MAP[model];
  if (!provider) throw new Error(`Unknown model: ${model}`);
  return provider;
}

function getApiKey(provider: AIProvider): string {
  const key = process.env[PROVIDER_ENV[provider]];
  if (!key) throw new Error(`${PROVIDER_ENV[provider]} is not configured`);
  return key;
}

// ─── Provider-specific call functions ───

async function callGeminiProvider(
  apiKey: string,
  model: string,
  opts: AICallOptions
): Promise<string> {
  const { prompt, systemPrompt, maxTokens = 65536, temperature = 0.7, jsonMode = false, signal } = opts;

  const generationConfig: Record<string, unknown> = { temperature, maxOutputTokens: maxTokens };
  if (jsonMode) {
    generationConfig.responseMimeType = "application/json";
  }

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig,
  };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errData = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errData}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No content in Gemini response");
  return text;
}

async function callAnthropicProvider(
  apiKey: string,
  model: string,
  opts: AICallOptions
): Promise<string> {
  const { prompt, systemPrompt, maxTokens = 4096, temperature = 0.7, signal } = opts;

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: "user", content: prompt }],
  };
  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errData = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errData}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error("No content in Anthropic response");
  return text;
}

async function callOpenAICompatibleProvider(
  apiKey: string,
  model: string,
  endpoint: string,
  opts: AICallOptions
): Promise<string> {
  const { prompt, systemPrompt, maxTokens = 4096, temperature = 0.7, jsonMode = false, signal } = opts;

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  };
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errData = await res.text();
    throw new Error(`API error ${res.status}: ${errData}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No content in API response");
  return text;
}

// ─── Core callAI ───

export async function callAI(opts: AICallOptions): Promise<{ text: string }> {
  const model = opts.model || DEFAULT_MODEL;
  const provider = getProviderForModel(model);
  const apiKey = getApiKey(provider);

  // Timeout: 120s default
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  const signal = opts.signal
    ? combineSignals(opts.signal, controller.signal)
    : controller.signal;

  const callOpts = { ...opts, signal };

  let lastError: Error | null = null;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let text: string;

      switch (provider) {
        case "gemini":
          text = await callGeminiProvider(apiKey, model, callOpts);
          break;
        case "anthropic":
          text = await callAnthropicProvider(apiKey, model, callOpts);
          break;
        case "moonshot":
          text = await callOpenAICompatibleProvider(
            apiKey, model, "https://api.moonshot.cn/v1/chat/completions", callOpts
          );
          break;
        case "openai":
          text = await callOpenAICompatibleProvider(
            apiKey, model, "https://api.openai.com/v1/chat/completions", callOpts
          );
          break;
      }

      clearTimeout(timeout);
      return { text: text! };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on abort or client errors (4xx)
      if (lastError.name === "AbortError") break;
      if (lastError.message.includes("API error 4")) break;

      // Retry on network/5xx errors
      if (attempt < maxRetries) continue;
    }
  }

  clearTimeout(timeout);
  throw lastError || new Error("AI call failed");
}

// ─── JSON variant ───

export function parseJSON<T>(raw: string): T {
  // Strip markdown code fences if present
  let cleaned = raw
    .replace(/^```(?:json)?\s*\n?/gm, "")
    .replace(/\n?```\s*$/gm, "")
    .trim();

  // Try direct parse
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall through to boundary extraction
  }

  // Find JSON boundaries
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");

  if (firstBrace === -1 && firstBracket === -1) {
    throw new Error("No JSON object or array found in response");
  }

  let start: number;
  let end: number;

  if (firstBracket === -1 || (firstBrace !== -1 && firstBrace < firstBracket)) {
    start = firstBrace;
    end = cleaned.lastIndexOf("}") + 1;
  } else {
    start = firstBracket;
    end = cleaned.lastIndexOf("]") + 1;
  }

  if (end <= start) {
    throw new Error("Malformed JSON in response");
  }

  cleaned = cleaned.slice(start, end);
  return JSON.parse(cleaned) as T;
}

export async function callAIJSON<T>(
  opts: AICallOptions & { retries?: number }
): Promise<T> {
  const { retries = 3, ...callOptions } = opts;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { text } = await callAI({ ...callOptions, jsonMode: true });
      return parseJSON<T>(text);
    } catch (err) {
      if (attempt === retries - 1) throw err;
    }
  }

  throw new Error("Failed to get valid JSON after retries");
}

// ─── Model utilities ───

export function getConfiguredProviders(): Record<AIProvider, boolean> {
  return {
    gemini: !!process.env.GEMINI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    moonshot: !!process.env.MOONSHOT_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
  };
}

export function getAvailableModels(): AIModel[] {
  const configured = getConfiguredProviders();
  return ALL_MODELS.filter((m) => configured[m.provider]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPreferredModel(
  supabase: SupabaseClient<any>,
  purpose: "site" | "article"
): Promise<string> {
  try {
    const { data } = await supabase
      .from("ai_settings")
      .select("*")
      .limit(1)
      .single();

    if (data) {
      const model = purpose === "site" ? data.default_site_model : data.default_article_model;
      if (model) {
        // Verify provider is configured
        const provider = MODEL_MAP[model];
        if (provider && process.env[PROVIDER_ENV[provider]]) {
          return model;
        }
      }
    }
  } catch {
    // Table may not exist yet or no row — fall through
  }

  return DEFAULT_MODEL;
}

// ─── Internal helpers ───

function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  a.addEventListener("abort", onAbort);
  b.addEventListener("abort", onAbort);
  if (a.aborted || b.aborted) controller.abort();
  return controller.signal;
}
