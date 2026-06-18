/**
 * Shared HTTP fetch helpers for substrate collectors.
 *
 * Phase 1 of the substrate buildout will dual-write ~10 legacy collectors
 * into the new schema. Inlining a retry helper into each one guarantees
 * drift; this module is the single source of truth so a fix to backoff
 * semantics ripples through every caller.
 */

export interface FetchRetryOpts {
  attempts?: number;
  baseMs?: number;
  userAgent?: string;
}

/**
 * Wrap `fetch()` with exponential backoff against transient 5xx and 429
 * responses. Non-transient errors (4xx other than 429, malformed responses)
 * throw immediately. Callers are responsible for parsing the response body.
 *
 * Defaults: 3 attempts, 1s → 2s → 4s backoff. Override per caller via opts.
 */
export async function fetchWithRetry(
  url: string,
  opts: FetchRetryOpts = {}
): Promise<Response> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 1000;
  const userAgent = opts.userAgent ?? "tamrack-substrate-collector";

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": userAgent } });
      if (res.ok) return res;
      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(`HTTP ${res.status}`);
        const wait = baseMs * 2 ** (attempt - 1);
        console.warn(
          `[fetch-retry] ${res.status} on attempt ${attempt}/${attempts} for ${url}; sleeping ${wait}ms`
        );
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      lastErr = err;
      if (attempt === attempts) break;
      const wait = baseMs * 2 ** (attempt - 1);
      console.warn(
        `[fetch-retry] ${(err as Error).message} on attempt ${attempt}/${attempts} for ${url}; sleeping ${wait}ms`
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr ?? new Error(`fetchWithRetry exhausted ${attempts} attempts for ${url}`);
}
