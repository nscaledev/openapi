import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LandingPage from "./page";

vi.mock("@/lib/raw-content", () => ({
  RAW_CONTENT_BASE: "https://raw.githubusercontent.com/nscaledev/openapi/main",
  fetchServiceIndex: vi.fn().mockResolvedValue({
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
  }),
}));

describe("LandingPage", () => {
  it("renders one row per published service, with a link to its reference page", async () => {
    render(await LandingPage());

    expect(screen.getByText("Compute Service API")).toBeVisible();
    expect(screen.getByText("v1.13.0")).toBeVisible();
    expect(screen.getByRole("link", { name: /reference/i })).toHaveAttribute(
      "href",
      "/reference/compute"
    );
  });

  it("renders icon+label action buttons for YAML, JSON, and the changelog", async () => {
    render(await LandingPage());

    expect(screen.getByRole("link", { name: /yaml/i })).toHaveAttribute(
      "href",
      "https://openapi.nscale.com/specs/compute/openapi.yaml"
    );
    expect(screen.getByRole("link", { name: /json/i })).toHaveAttribute(
      "href",
      "https://openapi.nscale.com/specs/compute/openapi.json"
    );
    expect(screen.getByRole("link", { name: /changelog/i })).toHaveAttribute(
      "href",
      "https://raw.githubusercontent.com/nscaledev/openapi/main/specs/compute/CHANGELOG.md"
    );
  });

  it("omits the docs button when a service has no docs link, rather than rendering a broken one", async () => {
    const { fetchServiceIndex } = await import("@/lib/raw-content");
    vi.mocked(fetchServiceIndex).mockResolvedValueOnce({
      services: [{ id: "partial", title: "Partial Service", version: "0.1.0" }],
    });

    render(await LandingPage());

    expect(screen.queryByRole("link", { name: /docs/i })).not.toBeInTheDocument();
  });

  it("renders an empty state when no services are published yet", async () => {
    const { fetchServiceIndex } = await import("@/lib/raw-content");
    vi.mocked(fetchServiceIndex).mockResolvedValueOnce({ services: [] });

    render(await LandingPage());

    expect(screen.getByText(/no services published yet/i)).toBeVisible();
  });
});
