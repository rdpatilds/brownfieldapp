"use client";

import "highlight.js/styles/github-dark.css";
import { Check, Copy } from "lucide-react";
import type { HTMLAttributes } from "react";
import { useCallback, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

function CodeBlock({ children, className, ...props }: HTMLAttributes<HTMLPreElement>) {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  const handleCopy = useCallback(async () => {
    try {
      const text = preRef.current?.textContent ?? "";
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. non-HTTPS or restricted context)
    }
  }, []);

  return (
    <div className="group/code relative">
      <pre ref={preRef} className={cn("overflow-x-auto", className)} {...props}>
        {children}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs text-white/70 opacity-0 transition-opacity hover:bg-white/20 hover:text-white group-hover/code:opacity-100"
      >
        {copied ? (
          <>
            <Check className="size-3" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="size-3" />
            Copy
          </>
        )}
      </button>
    </div>
  );
}

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{ pre: CodeBlock }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
