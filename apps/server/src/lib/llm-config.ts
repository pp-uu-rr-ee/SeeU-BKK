/**
 * Which LLM provider the server talks to. Everything goes through the OpenAI SDK, so any
 * OpenAI-compatible endpoint works (e.g. Gemini's free tier). LLM_* vars override the
 * OPENAI_* ones; with none set, behaviour is the original OpenAI setup.
 */
import { ChatOpenAI } from '@langchain/openai'

type Env = Record<string, string | undefined>

export interface LlmConfig {
  apiKey?: string
  baseURL?: string
  /** Overrides every caller's default chat model when set */
  chatModel?: string
  embedModel: string
  /** Must match the vector(1536) column; needed for models whose default size differs */
  embedDimensions?: number
  /** Chat models to try in order when the current one is rate limited (free-tier quotas are per model) */
  fallbackModels: string[]
}

function nonBlank(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function resolveLlmConfig(env: Env = process.env): LlmConfig {
  const dimensions = parseInt(env.LLM_EMBED_DIMENSIONS ?? '', 10)
  return {
    apiKey: nonBlank(env.LLM_API_KEY) ?? nonBlank(env.OPENAI_API_KEY),
    baseURL: nonBlank(env.LLM_BASE_URL) ?? nonBlank(env.OPENAI_BASE_URL),
    chatModel: nonBlank(env.LLM_MODEL),
    embedModel: nonBlank(env.LLM_EMBED_MODEL) ?? nonBlank(env.OPENAI_EMBED_MODEL) ?? 'text-embedding-3-small',
    embedDimensions: Number.isFinite(dimensions) && dimensions > 0 ? dimensions : undefined,
    fallbackModels: (env.LLM_FALLBACK_MODELS ?? '').split(',').map((m) => m.trim()).filter(Boolean),
  }
}

/** OpenAI SDK client options for the configured provider (same fixes and fallback as the agents) */
export function openAIClientOptions(config: LlmConfig = resolveLlmConfig()) {
  const fetch = providerFetch(config)
  return { apiKey: config.apiKey, baseURL: config.baseURL, ...(fetch ? { fetch } : {}) }
}

export function chatModelName(defaultModel: string, env: Env = process.env): string {
  return resolveLlmConfig(env).chatModel ?? defaultModel
}

// Google's documented placeholder for replaying a function call whose signature was lost
const SKIP_THOUGHT_SIGNATURE = 'skip_thought_signature_validator'

/**
 * Gemini 3 rejects replayed tool calls without a thought signature (400), and LangChain's
 * ChatOpenAI drops the `extra_content` that carries it. Fill the gap with the placeholder.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addMissingThoughtSignatures(body: any): any {
  if (!Array.isArray(body?.messages)) return body
  return {
    ...body,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: body.messages.map((message: any) =>
      Array.isArray(message?.tool_calls)
        ? {
            ...message,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tool_calls: message.tool_calls.map((call: any) =>
              call?.extra_content?.google?.thought_signature
                ? call
                : { ...call, extra_content: { ...call.extra_content, google: { thought_signature: SKIP_THOUGHT_SIGNATURE } } },
            ),
          }
        : message,
    ),
  }
}

/**
 * Gemini rejects requests whose last message is the model's ("Requests ending with a model
 * turn are not supported"). Agent hand-offs end that way (the researcher's output is the
 * last message the planner sees), so give the model a user turn to answer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function endWithUserTurn(body: any): any {
  const messages = body?.messages
  if (!Array.isArray(messages) || messages.at(-1)?.role !== 'assistant') return body
  return { ...body, messages: [...messages, { role: 'user', content: 'Continue.' }] }
}

type FetchFn = (input: Parameters<typeof fetch>[0], init?: RequestInit) => Promise<Response>

/**
 * On 429 for a chat request, resend it with each fallback model in turn. Embeddings are never
 * switched: vectors from another model can't be compared with the ones stored in the database.
 */
export function createModelFallbackFetch(fallbackModels: string[], baseFetch: FetchFn = fetch): FetchFn {
  return async (input, init) => {
    let res = await baseFetch(input, init)
    const isChat = String((input as Request)?.url ?? input).endsWith('/chat/completions')
    if (res.status !== 429 || !isChat || typeof init?.body !== 'string') return res

    let body: Record<string, unknown>
    try {
      body = JSON.parse(init.body)
    } catch {
      return res
    }
    for (const model of fallbackModels.filter((m) => m !== body.model)) {
      console.warn(`LLM rate limited on ${String(body.model)}, retrying with ${model}`)
      body = { ...body, model }
      res = await baseFetch(input, { ...init, body: JSON.stringify(body) })
      if (res.status !== 429) return res
    }
    return res
  }
}

/** Gemini request fixes (see above), then model fallback */
function providerFetch(config: LlmConfig): FetchFn | undefined {
  const isGemini = config.baseURL?.includes('generativelanguage.googleapis.com') ?? false
  if (!isGemini && config.fallbackModels.length === 0) return undefined
  const send = createModelFallbackFetch(config.fallbackModels)
  return (input, init) => {
    if (isGemini && typeof init?.body === 'string') {
      try {
        init = { ...init, body: JSON.stringify(endWithUserTurn(addMissingThoughtSignatures(JSON.parse(init.body)))) }
      } catch {
        // Not JSON: send as is
      }
    }
    return send(input, init)
  }
}

/** LangChain chat model for the agents, pointed at the configured provider */
export function createChatModel(defaultModel: string): ChatOpenAI {
  const config = resolveLlmConfig()
  const fetch = providerFetch(config)
  return new ChatOpenAI({
    maxRetries: 2,
    model: chatModelName(defaultModel),
    temperature: 0,
    apiKey: config.apiKey,
    configuration: { baseURL: config.baseURL, ...(fetch ? { fetch } : {}) },
  })
}
