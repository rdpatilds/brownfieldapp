"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";

export function useAutoScroll(containerRef: RefObject<HTMLDivElement | null>) {
  const userScrolledUp = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    const handleScroll = () => {
      const threshold = 100;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      userScrolledUp.current = distanceFromBottom > threshold;
    };

    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [containerRef]);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      userScrolledUp.current = false;
      el.scrollTop = el.scrollHeight;
    }
  }, [containerRef]);

  const isScrolledToBottom = useCallback(() => {
    return !userScrolledUp.current;
  }, []);

  return { scrollToBottom, isScrolledToBottom };
}
