import { describe, expect, it } from "vitest";
import { shapeCatalog } from "./service-catalog";

describe("shapeCatalog", () => {
  it("shapes a well-formed index.json into catalog entries", () => {
    const result = shapeCatalog({
      services: [
        {
          id: "compute",
          title: "Compute Service API",
          version: "1.13.0",
          spec: {
            yaml: "https://openapi.nscale.com/specs/compute/openapi.yaml",
            json: "https://openapi.nscale.com/specs/compute/openapi.json",
          },
          docs: "https://docs.nscale.com/api-reference/compute",
        },
      ],
    });

    expect(result).toEqual([
      {
        id: "compute",
        title: "Compute Service API",
        version: "1.13.0",
        specUrl: "https://openapi.nscale.com/specs/compute/openapi.yaml",
        jsonUrl: "https://openapi.nscale.com/specs/compute/openapi.json",
        docsUrl: "https://docs.nscale.com/api-reference/compute",
      },
    ]);
  });

  it("falls back to the id for a missing title, and to null for a missing docs link", () => {
    const result = shapeCatalog({
      services: [{ id: "compute", version: "1.0.0", spec: {} }],
    });

    expect(result).toEqual([
      {
        id: "compute",
        title: "compute",
        version: "1.0.0",
        specUrl: "",
        jsonUrl: "",
        docsUrl: null,
      },
    ]);
  });

  it("skips entries with no id", () => {
    const result = shapeCatalog({
      services: [{ title: "No id here" }, { id: "valid", version: "1.0.0" }],
    });

    expect(result.map((s) => s.id)).toEqual(["valid"]);
  });

  it("returns an empty array for a malformed or missing document", () => {
    expect(shapeCatalog(null)).toEqual([]);
    expect(shapeCatalog(undefined)).toEqual([]);
    expect(shapeCatalog({})).toEqual([]);
    expect(shapeCatalog({ services: "not-an-array" })).toEqual([]);
  });
});
