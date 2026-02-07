/**
 * In-memory token bucket rate limiter for upstream API calls.
 * One bucket per source, refills at a configured rate.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

// Requests per minute per source
const LIMITS: Record<string, number> = {
  semantic_scholar: 60, // ~1/sec (unauthenticated baseline)
  arxiv: 60,            // conservative; spec allows 3/sec
  openalex: 100,        // polite pool allows 10/sec
  crossref: 100,        // polite pool allows 50/sec
  pubmed: 60,           // 3/sec without API key
};

const DEFAULT_RPM = 60;

const buckets = new Map<string, Bucket>();

function getBucket(source: string): Bucket {
  let bucket = buckets.get(source);
  if (!bucket) {
    const max = LIMITS[source] ?? DEFAULT_RPM;
    bucket = { tokens: max, lastRefill: Date.now() };
    buckets.set(source, bucket);
  }
  return bucket;
}

function refill(bucket: Bucket, source: string): void {
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  const rpm = LIMITS[source] ?? DEFAULT_RPM;
  const tokensToAdd = (elapsed / 60_000) * rpm;
  bucket.tokens = Math.min(rpm, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;
}

/**
 * Wait until a rate-limit token is available for the given source.
 * Resolves immediately if tokens are available, otherwise sleeps
 * until a token can be consumed.
 */
export async function rateLimit(source: string): Promise<void> {
  const bucket = getBucket(source);
  refill(bucket, source);

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return;
  }

  // Wait for one token to refill
  const rpm = LIMITS[source] ?? DEFAULT_RPM;
  const waitMs = Math.ceil(60_000 / rpm);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  bucket.tokens = 0;
  bucket.lastRefill = Date.now();
}
