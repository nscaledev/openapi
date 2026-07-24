type Bucket = {
  tokens: number;
  windowStart: number;
};

export class TokenBucketRateLimiter {
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(options: { maxTokens: number; refillIntervalMs: number }) {
    this.maxTokens = options.maxTokens;
    this.refillIntervalMs = options.refillIntervalMs;
  }

  tryConsume(key: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now - bucket.windowStart >= this.refillIntervalMs) {
      this.buckets.set(key, { tokens: this.maxTokens - 1, windowStart: now });
      return true;
    }

    if (bucket.tokens <= 0) {
      return false;
    }

    bucket.tokens -= 1;
    return true;
  }
}
