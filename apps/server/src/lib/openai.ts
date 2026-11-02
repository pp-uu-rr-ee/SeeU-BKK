/**
 * OpenAI client wrappers for text generation and embeddings
 */
import OpenAI from 'openai'
import { wrapOpenAI } from 'langsmith/wrappers/openai'
import { chatModelName, openAIClientOptions, resolveLlmConfig } from './llm-config'

let rawClient: OpenAI | null = null
let wrappedClient: ReturnType<typeof wrapOpenAI> | null = null

function getRawOpenAIClient() {
  const options = openAIClientOptions()
  if (!options.apiKey) throw new Error('LLM_API_KEY / OPENAI_API_KEY is not set')
  if (!rawClient) {
    rawClient = new OpenAI(options)
  }
  return rawClient
}

function getWrappedOpenAIClient() {
  if (!wrappedClient) {
    wrappedClient = wrapOpenAI(getRawOpenAIClient())
  }
  return wrappedClient
}


export interface OpenAIOptions {
  model?: string
  max_completion_tokens?: number
  temperature?: number
  system?: string
  timeout_ms?: number
  retries?: number
}

export async function openaiGenerateText(input: string, opts: OpenAIOptions = {}): Promise<string> {
  const model = chatModelName(opts.model || 'gpt-5-mini-2025-08-07')
  const client = getWrappedOpenAIClient()

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
  if (opts.system) {
    messages.push({ role: 'system', content: opts.system })
  }
  messages.push({ role: 'user', content: input })

  const requestOptions: any = {}
  if (opts.timeout_ms) requestOptions.timeout = opts.timeout_ms

  const res = await client.chat.completions.create({
    model,
    messages,
    max_completion_tokens: typeof opts.max_completion_tokens === 'number' ? opts.max_completion_tokens : 512,
    temperature: typeof opts.temperature === 'number' ? opts.temperature : 1,
  }, requestOptions)

  const content = res?.choices?.[0]?.message?.content
  if (content) return content
  return JSON.stringify(res)
}


function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

// Embeddings via OpenAI Embeddings API
export interface OpenAIEmbedOptions {
  model?: string
  timeout_ms?: number
}

export async function openaiEmbed(text: string, opts: OpenAIEmbedOptions = {}): Promise<number[]> {
  const config = resolveLlmConfig()
  const model = opts.model || config.embedModel
  const client = getRawOpenAIClient()

  const requestOptions: any = {}
  if (opts.timeout_ms) requestOptions.timeout = opts.timeout_ms

  const resp = await client.embeddings.create(
    { model, input: text, ...(config.embedDimensions ? { dimensions: config.embedDimensions } : {}) },
    requestOptions,
  )
  const vec = resp?.data?.[0]?.embedding
  if (!vec || !Array.isArray(vec)) {
    throw new Error('OpenAI returned no embedding vector')
  }
  return vec as number[]
}