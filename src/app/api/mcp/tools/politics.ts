/**
 * `tamrack_politics` tool registration.
 *
 * Alberta political landscape: elected officials, recent parliamentary votes,
 * and electoral geography. Data is pre-collected by the daily collector
 * (Represent API + OpenParliament API) and served entirely from Postgres —
 * no live upstream fetches at read time.
 *
 * Datasets (4):
 *   mlas                — Alberta MLAs (name, party, district, contact)
 *   mps                 — Alberta federal MPs (name, party, riding, contact)
 *   votes               — Recent federal parliament votes (session, result,
 *                         yea/nay counts, bill link, description)
 *   electoral_districts — Alberta provincial electoral district boundaries
 *                         (name + Represent external_id)
 *
 * Honest scope: MLA and MP data reflects the most recent daily collection run.
 *   Parliamentary votes are capped at the last 25 stored rows by default
 *   (max 100 via the limit parameter). Election results and campaign
 *   contributions are NOT stored at this time.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  readMLAs,
  readMPs,
  readVotes,
  readElectoralDistricts,
  type MlaRow,
  type MpRow,
  type VoteRow,
  type DistrictRow,
} from "@/lib/collect-politics";

import { SCHEMA_VERSION } from "../schemas";
import { updateToolEntry } from "../registry";
import { requireScopes } from "../lib/auth-context";

const REQUIRED_SCOPES = ["tamrack:regional:read"] as const;

const POLITICS_DATASETS = ["mlas", "mps", "votes", "electoral_districts"] as const;
type PoliticsDataset = (typeof POLITICS_DATASETS)[number];

const PoliticsInputShape = {
  dataset: z
    .enum(POLITICS_DATASETS)
    .default("mlas")
    .describe(
      "Political dataset. " +
        "mlas = Alberta MLAs (provincial legislature, name/party/district/contact). " +
        "mps = Alberta federal MPs (House of Commons, name/party/riding/contact). " +
        "votes = Recent federal parliament votes (session, result, yea/nay, bill). " +
        "electoral_districts = Alberta provincial electoral districts (name + boundary id).",
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(25)
    .describe(
      "Maximum rows to return. Applies to votes (default 25, max 100). " +
        "Ignored for mlas, mps, electoral_districts (all stored rows are returned).",
    ),
};

// ---------------------------------------------------------------------------
// Zod payload schemas
// ---------------------------------------------------------------------------

const MlaRowSchema = z.object({
  name: z.string(),
  party: z.string(),
  district: z.string(),
  email: z.string(),
  url: z.string(),
});

const MpRowSchema = z.object({
  name: z.string(),
  party: z.string(),
  riding: z.string(),
  province: z.string(),
  email: z.string(),
  url: z.string(),
});

const VoteRowSchema = z.object({
  session: z.string(),
  number: z.number(),
  vote_date: z.string(),
  yea: z.number(),
  nay: z.number(),
  paired: z.number(),
  result: z.string(),
  bill_url: z.string(),
  description: z.string(),
});

const DistrictRowSchema = z.object({
  name: z.string(),
  external_id: z.string(),
  boundary_url: z.string(),
});

const PoliticsPayloadSchema = z.discriminatedUnion("dataset", [
  z.object({ dataset: z.literal("mlas"), rows: z.array(MlaRowSchema) }),
  z.object({ dataset: z.literal("mps"), rows: z.array(MpRowSchema) }),
  z.object({ dataset: z.literal("votes"), rows: z.array(VoteRowSchema) }),
  z.object({
    dataset: z.literal("electoral_districts"),
    rows: z.array(DistrictRowSchema),
  }),
]);

const PoliticsDataSchema = z.object({
  dataset: z.enum(POLITICS_DATASETS),
  source: z.string(),
  served_from: z.enum(["stored", "empty"]),
  notes: z.string().optional(),
  payload: PoliticsPayloadSchema,
});

const PoliticsEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal("tamrack_politics"),
  source: z.string(),
  data: PoliticsDataSchema,
});
type PoliticsEnvelope = z.infer<typeof PoliticsEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Registry update (flips status from "deferred" to "live")
// ---------------------------------------------------------------------------

const TOOL_NAME = "tamrack_politics";

const TOOL_DESCRIPTION =
  "Alberta political landscape — elected officials, recent parliamentary votes, " +
  "and electoral geography. All data is pre-collected daily from the Represent API " +
  "(open.north.ca, Open Government Licence) and OpenParliament API, then served " +
  "from Postgres — no live upstream fetches at read time. " +
  "Dataset `mlas` returns current Alberta MLAs (name, party, district, contact). " +
  "Dataset `mps` returns Alberta federal MPs. " +
  "Dataset `votes` returns recent federal parliament votes (yea/nay totals, result, bill). " +
  "Dataset `electoral_districts` returns Alberta provincial electoral district names and boundary IDs. " +
  "Scope required: tamrack:regional:read.";

updateToolEntry(TOOL_NAME, {
  status: "live",
  parameters_summary:
    "dataset (enum: mlas | mps | votes | electoral_districts; default mlas); " +
    "limit (int 1-100, default 25, applies to votes only).",
  response_summary:
    "Envelope with data.payload.rows[]. " +
    "mlas: { name, party, district, email, url }[]. " +
    "mps: { name, party, riding, province, email, url }[]. " +
    "votes: { session, number, vote_date, yea, nay, paired, result, bill_url, description }[]. " +
    "electoral_districts: { name, external_id, boundary_url }[]. " +
    "served_from is 'empty' when no data has been collected yet.",
  indicators: [...POLITICS_DATASETS],
  example_invocations: [
    {
      description: "List all Alberta MLAs with party and district.",
      arguments: { dataset: "mlas" },
    },
    {
      description: "List Alberta federal MPs.",
      arguments: { dataset: "mps" },
    },
    {
      description: "Last 10 federal parliament votes.",
      arguments: { dataset: "votes", limit: 10 },
    },
    {
      description: "Alberta electoral district list.",
      arguments: { dataset: "electoral_districts" },
    },
  ],
});

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerPoliticsTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Tamrack — Politics (MLAs, MPs, votes, districts)",
      description: TOOL_DESCRIPTION,
      inputSchema: PoliticsInputShape,
      annotations: {
        title: "Tamrack — Politics (MLAs, MPs, votes, districts)",
        readOnlyHint: true,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async (args) => {
      requireScopes(REQUIRED_SCOPES);

      const dataset = args.dataset as PoliticsDataset;
      const limit = args.limit ?? 25;
      const notesParts: string[] = [];

      let payload: z.infer<typeof PoliticsPayloadSchema>;
      let isEmpty = false;

      try {
        if (dataset === "mlas") {
          const rows: MlaRow[] = await readMLAs();
          isEmpty = rows.length === 0;
          payload = { dataset: "mlas", rows };
        } else if (dataset === "mps") {
          const rows: MpRow[] = await readMPs();
          isEmpty = rows.length === 0;
          payload = { dataset: "mps", rows };
        } else if (dataset === "votes") {
          const rows: VoteRow[] = await readVotes(limit);
          isEmpty = rows.length === 0;
          payload = { dataset: "votes", rows };
        } else {
          // electoral_districts
          const rows: DistrictRow[] = await readElectoralDistricts();
          isEmpty = rows.length === 0;
          payload = { dataset: "electoral_districts", rows };
        }
      } catch (err) {
        console.warn(`[mcp:${TOOL_NAME}] read failed:`, err);
        notesParts.push(
          `read threw: ${err instanceof Error ? err.message : String(err)}`,
        );
        isEmpty = true;
        // Provide a typed empty fallback so the envelope schema validates.
        if (dataset === "mlas") {
          payload = { dataset: "mlas", rows: [] };
        } else if (dataset === "mps") {
          payload = { dataset: "mps", rows: [] };
        } else if (dataset === "votes") {
          payload = { dataset: "votes", rows: [] };
        } else {
          payload = { dataset: "electoral_districts", rows: [] };
        }
      }

      if (isEmpty) {
        notesParts.push(
          "no politics data collected yet — the daily collector populates this table",
        );
      }

      const envelope: PoliticsEnvelope = {
        schema_version: SCHEMA_VERSION,
        tool: TOOL_NAME,
        source: "Represent API (open.north.ca) + OpenParliament API",
        data: {
          dataset,
          source:
            "Represent API (open.north.ca, Open Government Licence) + OpenParliament API",
          served_from: isEmpty ? "empty" : "stored",
          notes: notesParts.length > 0 ? notesParts.join("; ") : undefined,
          payload,
        },
      };

      const parsed = PoliticsEnvelopeSchema.parse(envelope);

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(parsed, null, 2) },
        ],
        structuredContent: parsed as unknown as Record<string, unknown>,
      };
    },
  );
}
