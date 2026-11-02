import { describe, expect, test } from "bun:test";
import {
  addMissingThoughtSignatures,
  chatModelName,
  createModelFallbackFetch,
  endWithUserTurn,
  resolveLlmConfig,
} from "../llm-config";

test("falls back to the OpenAI settings when no LLM_* vars are set", () => {
  const config = resolveLlmConfig({ OPENAI_API_KEY: "sk-test", OPENAI_EMBED_MODEL: "text-embedding-3-small" });
  expect(config).toEqual({
    apiKey: "sk-test",
    baseURL: undefined,
    chatModel: undefined,
    embedModel: "text-embedding-3-small",
    embedDimensions: undefined,
    fallbackModels: [],
  });
});

test("LLM_* vars override the OpenAI ones (e.g. Gemini's OpenAI-compatible endpoint)", () => {
  const config = resolveLlmConfig({
    OPENAI_API_KEY: "sk-test",
    OPENAI_EMBED_MODEL: "text-embedding-3-small",
    LLM_API_KEY: "gemini-key",
    LLM_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    LLM_MODEL: "gemini-3.5-flash-lite",
    LLM_EMBED_MODEL: "gemini-embedding-001",
    LLM_EMBED_DIMENSIONS: "1536",
    LLM_FALLBACK_MODELS: " gemini-3.1-flash-lite, ,gemini-3.5-flash ",
  });
  expect(config).toEqual({
    apiKey: "gemini-key",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    chatModel: "gemini-3.5-flash-lite",
    embedModel: "gemini-embedding-001",
    embedDimensions: 1536,
    fallbackModels: ["gemini-3.1-flash-lite", "gemini-3.5-flash"],
  });
});

test("defaults the embedding model and ignores blank or invalid values", () => {
  const config = resolveLlmConfig({ LLM_MODEL: "  ", LLM_BASE_URL: "", LLM_EMBED_DIMENSIONS: "abc" });
  expect(config.chatModel).toBeUndefined();
  expect(config.baseURL).toBeUndefined();
  expect(config.embedModel).toBe("text-embedding-3-small");
  expect(config.embedDimensions).toBeUndefined();
});

test("chatModelName keeps each caller's default unless LLM_MODEL is set", () => {
  expect(chatModelName("gpt-5-nano", {})).toBe("gpt-5-nano");
  expect(chatModelName("gpt-5-nano", { LLM_MODEL: "gemini-3.5-flash-lite" })).toBe("gemini-3.5-flash-lite");
});

test("adds Gemini's skip signature to replayed tool calls that lost theirs", () => {
  const body = {
    model: "gemini-3.5-flash-lite",
    messages: [
      { role: "user", content: "Find Wat Pho" },
      {
        role: "assistant",
        content: "",
        tool_calls: [
          { id: "a", type: "function", function: { name: "search_places", arguments: "{}" } },
          {
            id: "b",
            type: "function",
            function: { name: "search_places", arguments: "{}" },
            extra_content: { google: { thought_signature: "real-sig" } },
          },
        ],
      },
      { role: "tool", tool_call_id: "a", content: "[]" },
    ],
  };
  const out = addMissingThoughtSignatures(body);
  const calls = out.messages[1].tool_calls;
  expect(calls[0].extra_content).toEqual({ google: { thought_signature: "skip_thought_signature_validator" } });
  expect(calls[1].extra_content).toEqual({ google: { thought_signature: "real-sig" } });
  expect(out.messages[0]).toEqual(body.messages[0]);
});

test("leaves bodies without tool calls untouched", () => {
  const body = { model: "x", messages: [{ role: "user", content: "hi" }] };
  expect(addMissingThoughtSignatures(body)).toEqual(body);
});

test("appends a user turn when a request ends with a model turn (agent hand-offs)", () => {
  const body = {
    messages: [
      { role: "system", content: "planner" },
      { role: "user", content: "Plan a walk" },
      { role: "assistant", content: "research notes", name: "researcher_agent" },
    ],
  };
  const out = endWithUserTurn(body);
  expect(out.messages).toHaveLength(4);
  expect(out.messages[3]).toEqual({ role: "user", content: "Continue." });
});

test("keeps requests that already end with a user or tool turn", () => {
  const userLast = { messages: [{ role: "user", content: "hi" }] };
  const toolLast = { messages: [{ role: "assistant", content: "", tool_calls: [] }, { role: "tool", content: "[]" }] };
  expect(endWithUserTurn(userLast)).toEqual(userLast);
  expect(endWithUserTurn(toolLast)).toEqual(toolLast);
});

describe("createModelFallbackFetch", () => {
  const url = "https://example.test/v1/chat/completions";
  const fakeFetch = (statusByModel: Record<string, number>, seen: string[]) =>
    (async (_input: unknown, init?: RequestInit) => {
      const model = JSON.parse(String(init?.body)).model as string;
      seen.push(model);
      return new Response("{}", { status: statusByModel[model] ?? 200 });
    }) as unknown as typeof fetch;

  test("retries a rate-limited chat request on the next model", async () => {
    const seen: string[] = [];
    const doFetch = createModelFallbackFetch(["b", "c"], fakeFetch({ a: 429, b: 429 }, seen));
    const res = await doFetch(url, { method: "POST", body: JSON.stringify({ model: "a", messages: [] }) });
    expect(res.status).toBe(200);
    expect(seen).toEqual(["a", "b", "c"]);
  });

  test("returns the last 429 when every model is rate limited", async () => {
    const seen: string[] = [];
    const doFetch = createModelFallbackFetch(["b"], fakeFetch({ a: 429, b: 429 }, seen));
    const res = await doFetch(url, { method: "POST", body: JSON.stringify({ model: "a" }) });
    expect(res.status).toBe(429);
    expect(seen).toEqual(["a", "b"]);
  });

  test("never switches models for embeddings (vectors from different models don't mix)", async () => {
    const seen: string[] = [];
    const doFetch = createModelFallbackFetch(["b"], fakeFetch({ a: 429 }, seen));
    const res = await doFetch("https://example.test/v1/embeddings", { method: "POST", body: JSON.stringify({ model: "a" }) });
    expect(res.status).toBe(429);
    expect(seen).toEqual(["a"]);
  });
});
