import { beforeEach, describe, expect, it, vi } from "vitest";
import { TokenBucketRateLimiter } from "./rate-limit";

describe("TokenBucketRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("allows up to the configured number of requests per key", () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 3, refillIntervalMs: 60_000 });

    expect(limiter.tryConsume("1.2.3.4")).toBe(true);
    expect(limiter.tryConsume("1.2.3.4")).toBe(true);
    expect(limiter.tryConsume("1.2.3.4")).toBe(true);
    expect(limiter.tryConsume("1.2.3.4")).toBe(false);
  });

  it("tracks separate buckets per key", () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 1, refillIntervalMs: 60_000 });

    expect(limiter.tryConsume("1.2.3.4")).toBe(true);
    expect(limiter.tryConsume("5.6.7.8")).toBe(true);
    expect(limiter.tryConsume("1.2.3.4")).toBe(false);
  });

  it("refills after the configured interval", () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 1, refillIntervalMs: 60_000 });

    expect(limiter.tryConsume("1.2.3.4")).toBe(true);
    expect(limiter.tryConsume("1.2.3.4")).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(limiter.tryConsume("1.2.3.4")).toBe(true);
  });
});
