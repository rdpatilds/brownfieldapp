import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessageBubble } from "../message-bubble";

describe("MessageBubble", () => {
  it("renders user message content", () => {
    // biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not an ARIA role
    render(<MessageBubble role="user" content="Hello there" />);
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  it("renders assistant message content", () => {
    // biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not an ARIA role
    render(<MessageBubble role="assistant" content="Hi! How can I help?" />);
    expect(screen.getByText(/How can I help/)).toBeInTheDocument();
  });

  it("shows user icon for user messages", () => {
    // biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not an ARIA role
    const { container } = render(<MessageBubble role="user" content="Test" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("justify-end");
  });

  it("shows bot icon for assistant messages", () => {
    // biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not an ARIA role
    const { container } = render(<MessageBubble role="assistant" content="Test" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("justify-start");
  });

  it("renders source references for assistant messages with sources", () => {
    const sources = [
      { index: 1, title: "OpenAI Funding Doc", source: "documents/doc1.md" },
      { index: 2, title: "Anthropic Amazon Doc", source: "documents/doc2.md" },
    ];
    // biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not an ARIA role
    render(<MessageBubble role="assistant" content="The answer is [1][2]." sources={sources} />);

    const sourceSection = screen.getByTestId("source-references");
    expect(sourceSection).toBeInTheDocument();
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("OpenAI Funding Doc")).toBeInTheDocument();
    expect(screen.getByText("Anthropic Amazon Doc")).toBeInTheDocument();
    expect(screen.getByText("[1]")).toBeInTheDocument();
    expect(screen.getByText("[2]")).toBeInTheDocument();
  });

  it("does not render source references when sources is undefined", () => {
    // biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not an ARIA role
    render(<MessageBubble role="assistant" content="A regular response" />);

    expect(screen.queryByTestId("source-references")).not.toBeInTheDocument();
  });

  it("does not render source references for user messages even if sources provided", () => {
    const sources = [{ index: 1, title: "Doc", source: "doc.md" }];
    // biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not an ARIA role
    render(<MessageBubble role="user" content="A question" sources={sources} />);

    expect(screen.queryByTestId("source-references")).not.toBeInTheDocument();
  });

  it("does not render source references when sources array is empty", () => {
    // biome-ignore lint/a11y/useValidAriaRole: role is a component prop, not an ARIA role
    render(<MessageBubble role="assistant" content="No sources" sources={[]} />);

    expect(screen.queryByTestId("source-references")).not.toBeInTheDocument();
  });
});
