import { describe, expect, it } from "vitest";
import { isValidServiceId } from "./service-param";

describe("isValidServiceId", () => {
  it("accepts a plain lowercase-kebab id", () => {
    expect(isValidServiceId("compute")).toBe(true);
    expect(isValidServiceId("fleet-manager")).toBe(true);
  });

  it("rejects path traversal attempts entirely", () => {
    expect(isValidServiceId("../../etc/passwd")).toBe(false);
    expect(isValidServiceId("..%2f..%2fetc")).toBe(false);
  });

  it("rejects uppercase and whitespace-containing values", () => {
    expect(isValidServiceId("Compute")).toBe(false);
    expect(isValidServiceId("compute ")).toBe(false);
    expect(isValidServiceId(" compute")).toBe(false);
  });

  it("rejects empty, null, and undefined", () => {
    expect(isValidServiceId("")).toBe(false);
    expect(isValidServiceId(null)).toBe(false);
    expect(isValidServiceId(undefined)).toBe(false);
  });
});
