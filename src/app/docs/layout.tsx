import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import { source } from "@/lib/source";
import "fumadocs-ui/style.css";
import "./fumadocs-theme.css";

// Tamrack developer docs. Mounted at `/docs` (see next.config.ts —
// the legacy `/docs → /tools/docs` redirect was removed in this commit).
// Theme tokens live in `fumadocs-theme.css` and pick up the existing
// terracotta accent (`--accent: #c06a2b`) from `src/app/globals.css`.
export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return (
    <RootProvider>
      <DocsLayout
        tree={source.pageTree}
        nav={{
          title: "Tamrack docs",
          url: "/docs",
        }}
        sidebar={{
          defaultOpenLevel: 1,
        }}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
