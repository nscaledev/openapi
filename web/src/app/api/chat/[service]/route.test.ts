import { describe, expect, it, vi, beforeEach } from "vitest";

const streamTextMock = vi.fn();

vi.mock("ai", () => ({
  streamText: streamTextMock,
}));

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => ({
    languageModel: vi.fn((model: string) => ({ model })),
  })),
}));

describe("POST /api/chat/[service]", () => {
  beforeEach(() => {
    // The route module holds a module-scoped rate-limiter instance —
    // reset modules per test so each test starts with a fresh limiter,
    // not one that's accumulated state from a previous test.
    vi.resetModules();
    streamTextMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("openapi: 3.0.3\ninfo:\n  title: Compute Service API"),
      })
    );
    process.env.NSCALE_INFERENCE_API_HOST = "https://inference.example.com";
    process.env.NSCALE_INFERENCE_API_KEY = "test-key";
    process.env.NSCALE_INFERENCE_MODEL = "test-model";
  });

  it("returns 404 for an invalid service id, without calling the inference API", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/chat/../../etc", {
      method: "POST",
      body: JSON.stringify({ messages: [] }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ service: "../../etc" }),
    });

    expect(response.status).toBe(404);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("returns 502 when the upstream spec fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/chat/compute", {
      method: "POST",
      body: JSON.stringify({ messages: [] }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ service: "compute" }),
    });

    expect(response.status).toBe(502);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("streams a response grounded in the fetched spec for a valid service", async () => {
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: () => new Response("ok", { status: 200 }),
    });
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/chat/compute", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ service: "compute" }),
    });

    expect(response.status).toBe(200);
    expect(streamTextMock).toHaveBeenCalledTimes(1);
    const call = streamTextMock.mock.calls[0][0];
    expect(call.system).toContain("Compute Service API");
    expect(call.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("returns 429 once a caller exceeds the rate limit, without calling the inference API", async () => {
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: () => new Response("ok", { status: 200 }),
    });
    const { POST } = await import("./route");
    const makeRequest = () =>
      new Request("http://localhost/api/chat/compute", {
        method: "POST",
        headers: { "x-forwarded-for": "9.9.9.9" },
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      });

    // The route's limiter allows 5 requests per minute per IP (see
    // implementation) — the 6th from the same IP must be rejected.
    for (let i = 0; i < 5; i++) {
      const ok = await POST(makeRequest(), {
        params: Promise.resolve({ service: "compute" }),
      });
      expect(ok.status).toBe(200);
    }

    streamTextMock.mockClear();
    const limited = await POST(makeRequest(), {
      params: Promise.resolve({ service: "compute" }),
    });

    expect(limited.status).toBe(429);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("returns 500 when a required inference env var is missing, without calling the inference API", async () => {
    delete process.env.NSCALE_INFERENCE_API_KEY;
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/chat/compute", {
      method: "POST",
      headers: { "x-forwarded-for": "5.5.5.5" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ service: "compute" }),
    });

    expect(response.status).toBe(500);
    expect(streamTextMock).not.toHaveBeenCalled();
  });
});
