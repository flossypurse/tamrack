"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Posts height to parent window for auto-resizing JS widget embeds */
export function EmbedResize() {
  const pathname = usePathname();

  useEffect(() => {
    if (!window.parent || window.parent === window) return;

    const chartId = pathname.replace("/embed/", "");

    function postHeight() {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage(
        JSON.stringify({ type: "ap-resize", chartId, height }),
        "*"
      );
    }

    // Post initial height after render settles
    const t = setTimeout(postHeight, 500);
    // Observe for layout changes
    const observer = new ResizeObserver(postHeight);
    observer.observe(document.body);

    return () => {
      clearTimeout(t);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
