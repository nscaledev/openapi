import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatWidget } from "./chat-widget";

const sendMessageMock = vi.fn();

vi.mock("@ai-sdk/react", () => ({
  useChat: vi.fn(() => ({
    messages: [],
    sendMessage: sendMessageMock,
    status: "ready",
  })),
}));

describe("ChatWidget", () => {
  it("renders an input and a send button", () => {
    render(<ChatWidget serviceId="compute" />);

    expect(screen.getByRole("textbox")).toBeVisible();
    expect(screen.getByRole("button", { name: /send/i })).toBeVisible();
  });

  it("sends the typed message when submitted", async () => {
    const user = userEvent.setup();
    render(<ChatWidget serviceId="compute" />);

    await user.type(screen.getByRole("textbox"), "What endpoints exist?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(sendMessageMock).toHaveBeenCalledWith({
      text: "What endpoints exist?",
    });
  });
});
