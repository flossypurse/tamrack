/**
 * Smart UI title summarizer.
 *
 * One Haiku call per saved dashboard: turn the user's raw query into a
 * 4-6 word title for the history sidebar. Fire-and-forget from the
 * /api/smart/query route — never block the user's "done" event on this.
 */
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM = `You produce 4-6 word titles for a list of past data questions.

Rules:
- 4 to 6 words, no more
- Title case
- No trailing punctuation
- No quotes around the title
- Drop filler ("show me", "what is", "can you")
- Keep concrete nouns (places, indicators, years)
- Output ONLY the title text. No preamble, no explanation.

Examples:
Query: "alberta unemployment last 5 years"
Title: Alberta Unemployment, Last 5 Years

Query: "what's the policy rate in canada right now"
Title: Canada Policy Rate Today

Query: "edmonton housing starts 2024 vs 2023"
Title: Edmonton Housing Starts 2024 vs 2023`;

export interface GenerateTitleOptions {
  apiKey?: string;
  model?: string;
}

export async function generateTitle(
  query: string,
  options: GenerateTitleOptions = {},
): Promise<string> {
  const apiKey =
    options.apiKey ??
    process.env.ANTHROPIC_TAMRACK_API_TOKEN ??
    process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_TAMRACK_API_TOKEN is not set");
  }
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: options.model ?? MODEL,
    max_tokens: 40,
    system: [
      {
        type: "text",
        text: SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: `Query: "${query}"\nTitle:` }],
  });

  const textBlock = response.content.find(
    (c): c is Anthropic.TextBlock => c.type === "text",
  );
  if (!textBlock) {
    throw new Error("Title: no text block in Haiku response");
  }

  return sanitizeTitle(textBlock.text);
}

export function sanitizeTitle(raw: string): string {
  let t = raw.trim();
  // Strip surrounding quotes the model sometimes adds despite the prompt.
  t = t.replace(/^["'`]+/, "").replace(/["'`]+$/, "");
  // Strip trailing punctuation.
  t = t.replace(/[.!?,;:]+$/, "");
  // Collapse whitespace.
  t = t.replace(/\s+/g, " ").trim();
  // Hard cap at 80 chars to defend against runaway output.
  if (t.length > 80) t = t.slice(0, 80).trim();
  return t;
}

/**
 * Fallback when the title call fails — derive a short label from the raw
 * query. Used by the sidebar so it never renders a blank row.
 */
export function fallbackTitle(query: string): string {
  const cleaned = query.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 60) return cleaned;
  return cleaned.slice(0, 57).trim() + "…";
}
