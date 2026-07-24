import { describe, expect, it } from "vitest";
import { shapeCatalog } from "./service-catalog";

describe("shapeCatalog", () => {
  it("shapes a well-formed index.json into catalog entries", () => {
    const result = shapeCatalog({
      services: [
        {
          id: "example-service",
          title: "Example Service API",
          version: "1.13.0",
          spec: {
            yaml: "https://openapi.nscale.com/specs/example-service/openapi.yaml",
            json: "https://openapi.nscale.com/specs/example-service/openapi.json",
          },
          docs: "https://docs.nscale.com/api-reference/example-service",
        },
      ],
    });

    expect(result).toEqual([
      {
        id: "example-service",
        title: "Example Service API",
        version: "1.13.0",
        specUrl: "https://openapi.nscale.com/specs/example-service/openapi.yaml",
        jsonUrl: "https://openapi.nscale.com/specs/example-service/openapi.json",
        docsUrl: "https://docs.nscale.com/api-reference/example-service",
      },
    ]);
  });

  it("falls back to the id for a missing title, and to null for a missing docs link", () => {
    const result = shapeCatalog({
      services: [{ id: "example-service", version: "1.0.0", spec: {} }],
    });

    expect(result).toEqual([
      {
        id: "example-service",
        title: "example-service",
        version: "1.0.0",
        specUrl: "",
        jsonUrl: "",
        docsUrl: null,
      },
    ]);
  });

  it("uses the curated display name for known services, regardless of the spec's own title", () => {
    const result = shapeCatalog({
      services: [
        { id: "compute", title: "Compute Service API", version: "1.13.0" },
        { id: "reservation", title: "Unikorn Reservation API", version: "0.5.0" },
      ],
    });

    expect(result.map((s) => s.title)).toEqual(["Compute", "Reservations"]);
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
