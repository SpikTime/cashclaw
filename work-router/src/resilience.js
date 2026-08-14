export class SourceError extends Error {
  constructor(message, { code = "SOURCE_FAILED", source = "unknown", status = 0, retryAfter = 0, degraded = true, cause } = {}) {
    super(message, { cause });
    this.name = "SourceError";
    Object.assign(this, { code, source, status, retryAfter, degraded });
  }
}

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

export async function withRetry(operation, { attempts = 3, baseDelayMs = 500, maxDelayMs = 10_000, jitter = Math.random, sleep = delay } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await operation(attempt); }
    catch (error) {
      lastError = error;
      if (attempt >= attempts || error?.retryable === false) break;
      const serverDelay = Number(error?.retryAfter || 0) * 1000;
      const backoff = Math.min(maxDelayMs, baseDelayMs * (2 ** (attempt - 1)));
      await sleep(Math.max(serverDelay, backoff) + Math.floor(jitter() * Math.max(1, backoff * 0.25)));
    }
  }
  throw lastError;
}

export async function withTimeout(operation, timeoutMs, label = "operation") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await operation(controller.signal); }
  catch (error) {
    if (error?.name === "AbortError" || controller.signal.aborted) throw new SourceError(`${label} timed out`, { code: "TIMEOUT", cause: error });
    throw error;
  } finally { clearTimeout(timer); }
}
