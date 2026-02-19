import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";

import { MarkdownContent } from "../markdown-content";

describe("MarkdownContent", () => {
  it("renders plain text", () => {
    render(<MarkdownContent content="Hello world" />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders bold text", () => {
    render(<MarkdownContent content="This is **bold** text" />);
    expect(screen.getByText("bold")).toBeInTheDocument();
  });

  it("renders code blocks", () => {
    render(<MarkdownContent content={'```js\nconsole.log("hi")\n```'} />);
    expect(screen.getByText(/console/)).toBeInTheDocument();
  });

  it("renders links", () => {
    render(<MarkdownContent content="[Example](https://example.com)" />);
    const link = screen.getByRole("link", { name: "Example" });
    expect(link).toHaveAttribute("href", "https://example.com");
  });

  it("renders lists", () => {
    render(<MarkdownContent content={"- Item 1\n- Item 2\n- Item 3"} />);
    const list = screen.getByRole("list");
    expect(list).toBeInTheDocument();
    expect(list.textContent).toContain("Item 1");
    expect(list.textContent).toContain("Item 2");
    expect(list.textContent).toContain("Item 3");
  });
});
