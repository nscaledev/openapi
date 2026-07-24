export function buildSystemPrompt(
  serviceTitle: string,
  specYaml: string
): string {
  return [
    `You are a documentation assistant for the ${serviceTitle} API.`,
    "Answer questions using only the OpenAPI specification below. " +
      "If the answer isn't in the spec, say so rather than guessing.",
    "",
    "```yaml",
    specYaml,
    "```",
  ].join("\n");
}
