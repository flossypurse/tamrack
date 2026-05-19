import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

// MDX component overrides for Tamrack docs. Today this just re-exports
// Fumadocs' defaults (Card/Cards/Callout/CodeBlockTabs/Tabs/Steps/etc).
// Add Tamrack-specific shortcodes here when the per-endpoint template
// grows (e.g., <ScopeBadge>, <CostUnits>, <UpstreamSourceList>).
export function getMDXComponents(overrides?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...(overrides ?? {}),
  };
}
