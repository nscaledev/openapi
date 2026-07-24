import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReferencePage from "./page";

vi.mock("@scalar/api-reference-react", () => ({
  ApiReferenceReact: ({ configuration }: { configuration: { url: string } }) => (
    <div data-testid="scalar-reference">{configuration.url}</div>
  ),
}));

vi.mock("@scalar/api-reference-react/style.css", () => ({}));

const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

describe("ReferencePage", () => {
  it("renders Scalar pointed at the requested service's spec URL", async () => {
    render(
      await ReferencePage({ params: Promise.resolve({ service: "compute" }) })
    );

    expect(screen.getByTestId("scalar-reference")).toHaveTextContent(
      "specs/compute/openapi.json"
    );
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("calls notFound() for an invalid service id, without rendering Scalar", async () => {
    await expect(
      ReferencePage({ params: Promise.resolve({ service: "../../etc" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
