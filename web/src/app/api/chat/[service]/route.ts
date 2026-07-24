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

const REQUIRED_ENV_VARS = [
  "NSCALE_INFERENCE_API_HOST",
  "NSCALE_INFERENCE_API_KEY",
  "NSCALE_INFERENCE_MODEL",
] as const;

function missingEnvVars(): string[] {
  return REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
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

  const missing = missingEnvVars();
  if (missing.length > 0) {
    console.error(`chat route: missing required env var(s): ${missing.join(", ")}`);
    return new Response("Chat is not configured", { status: 500 });
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
