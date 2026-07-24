"use client";

import { useChat } from "@ai-sdk/react";
import { Button } from "@nscaledev/ui/components-v2/button";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

export function ChatWidget({ serviceId }: { serviceId: string }) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/chat/${serviceId}`,
    }),
  });

  return (
    <div className="flex flex-col gap-4 p-4 border border-primary-border rounded-xl bg-primary-background">
      <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
        {messages.map((message) => (
          <div key={message.id} data-role={message.role}>
            {message.parts
              .filter((part) => part.type === "text")
              .map((part, i) => (
                <p key={i}>{part.text}</p>
              ))}
          </div>
        ))}
        {status === "error" && (
          <p role="alert" className="text-destructive">
            Something went wrong talking to the assistant. Try again in a
            moment.
          </p>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          sendMessage({ text: input });
          setInput("");
        }}
        className="flex gap-2"
      >
        <input
          className="flex-1 border border-primary-border rounded-md px-3 py-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this API..."
        />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
