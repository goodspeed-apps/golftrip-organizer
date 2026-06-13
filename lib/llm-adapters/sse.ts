/**
 * Shared SSE (Server-Sent Events) line parser for streaming LLM adapters.
 *
 * Each provider's wire format slices `data: …` payloads slightly differently
 * (OpenAI uses `[DONE]` as a sentinel, Anthropic emits typed event objects),
 * but the framing, read chunks, accumulate until newline, strip `data:`
 * prefix, is identical. This module extracts that loop so openai.ts and
 * anthropic.ts only ship a tiny `decode(payload) => yields | done` lambda.
 */

/**
 * Signal returned from a per-line decoder callback.
 *
 * - `{ chunks: string[] }`, emit zero or more strings to the consumer
 * - `{ done: true }`, end the stream early (OpenAI `[DONE]` sentinel)
 */
export type SseDecodeResult = { chunks?: string[]; done?: boolean };

/**
 * Stream `data:` lines out of a Fetch Response body, yielding whatever the
 * `decode` callback extracts from each payload.
 *
 * The decoder owns provider-specific JSON parsing; this function owns:
 * - chunked UTF-8 decoding
 * - newline-buffered line splitting
 * - skipping non-`data:` lines (event:, retry:, comments)
 * - graceful handling of malformed payloads (decoder may throw, we swallow)
 */
export async function* parseSSE(
  resp: Response,
  decode: (payload: string) => SseDecodeResult,
): AsyncIterable<string> {
  if (!resp.body) return;
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      try {
        const result = decode(payload);
        if (result.done) return;
        if (result.chunks) {
          for (const chunk of result.chunks) yield chunk;
        }
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}