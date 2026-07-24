import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { buildSystemPrompt } from "@/lib/chat-system-prompt";
import { fetchServiceSpecYaml } from "@/lib/raw-content";
import { TokenBucketRateLimiter } from "@/lib/rate-limit";
import { isValidServiceId } from "@/lib/service-param";
import { parse } from "yaml";

// Module-scoped: one limiter shared across requests to this pod. Resets on
// restart/redeploy and doesn't coordinate across replicas — a documented
// stopgap (see design doc), not a substitute for ingress-level rate limiting.
const rateLimiter = new TokenBucketRateLimiter({
  maxTokens: 5,
  refillIntervalMs: 60_000,
});

function clientKeyFor(request: Request): string {
  return request.headers.get("x-forwarded-for") ?? "unknown";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ service: string }> }
) {
  if (!rateLimiter.tryConsume(clientKeyFor(request))) {
    return new Response("Too many requests", { status: 429 });
  }

  const { service } = await params;

  if (!isValidServiceId(service)) {
    return new Response("Not found", { status: 404 });
  }

  const specYaml = await fetchServiceSpecYaml(service);
  if (specYaml === null) {
    return new Response("Spec temporarily unavailable", { status: 502 });
  }

  const { messages } = await request.json();
  const parsedSpec = parse(specYaml) as { info?: { title?: string } };
  const serviceTitle = parsedSpec?.info?.title ?? service;

  const provider = createOpenAICompatible({
    name: "nscale",
    baseURL: `${process.env.NSCALE_INFERENCE_API_HOST}/v1`,
    headers: {
      Authorization: `Bearer ${process.env.NSCALE_INFERENCE_API_KEY}`,
    },
  });

  const result = streamText({
    model: provider.languageModel(process.env.NSCALE_INFERENCE_MODEL ?? ""),
    system: buildSystemPrompt(serviceTitle, specYaml),
    messages,
  });

  return result.toUIMessageStreamResponse();
}
