import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./chat-system-prompt";

describe("buildSystemPrompt", () => {
  it("includes the service title and the full spec content", () => {
    const prompt = buildSystemPrompt("Compute Service API", "openapi: 3.0.3");

    expect(prompt).toContain("Compute Service API");
    expect(prompt).toContain("openapi: 3.0.3");
  });

  it("instructs the model to answer only from the spec", () => {
    const prompt = buildSystemPrompt("Compute Service API", "openapi: 3.0.3");

    expect(prompt.toLowerCase()).toContain("only");
  });
});
