import { defineConfig, defineDocs, frontmatterSchema } from "fumadocs-mdx/config";
import { z } from "zod";

// Fumadocs MDX source configuration.
//
// IMPORTANT: this file's only allowed exports are `defineDocs` collections
// and `defineConfig()` (default). Helper schemas must be inlined — top-level
// re-exports trigger:
//   "Unknown export ..., you can only export collections from source
//    configuration file."
//
// Tamrack frontmatter extends Fumadocs' built-in schema with three fields
// used by the per-endpoint template:
//   scope       — tamrack:<area>:read (string, optional on non-endpoint pages)
//   cost_units  — number of units charged per successful call
//   status      — live | beta | alpha | planned
export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: frontmatterSchema.extend({
      scope: z.string().optional(),
      cost_units: z.number().optional(),
      status: z.enum(["live", "beta", "alpha", "planned"]).optional(),
    }),
  },
});

export default defineConfig();
