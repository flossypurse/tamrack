/**
 * assembleStorySpec — story template renderer.
 *
 * Takes a raw Vega-Lite template spec from corpus.chart_templates and
 * populates only the permitted composer-writable slots (title, annotations,
 * data_ref). Structural properties (mark, encoding.field, encoding.type,
 * transform) are locked — the composer may not touch them.
 *
 * The function performs a deepClone of the template before any mutations so
 * the original template object is never modified.
 *
 * Slot population contract (all other keys are preserved from the template):
 *   title       ← StoryCard.title
 *   data.name   ← StoryCard.data_ref  (named data source for Vega-Lite)
 *   description ← StoryCard.body (truncated to 280 chars, or omitted)
 *
 * Locked props the function enforces by stripping any overrides:
 *   mark, encoding.field, encoding.type, encoding.*.field,
 *   encoding.*.type, transform
 */

import type { StoryCard } from "./types";

/** A minimal Vega-Lite top-level spec shape (structural subset). */
interface VegaLiteSpec {
  $schema?: string;
  title?: string;
  description?: string;
  mark?: unknown;
  encoding?: Record<string, unknown>;
  transform?: unknown;
  data?: { name?: string; values?: unknown; url?: string };
  [key: string]: unknown;
}

/**
 * Locked top-level keys that the composer must not modify.
 * Any value for these keys in the template is preserved exactly.
 */
const LOCKED_TOP_LEVEL: ReadonlySet<string> = new Set([
  "mark",
  "transform",
]);

/**
 * Locked nested keys within each encoding channel.
 * The composer may not override field, type, or aggregate.
 */
const LOCKED_ENCODING_CHANNEL_KEYS: ReadonlySet<string> = new Set([
  "field",
  "type",
  "aggregate",
]);

/**
 * deepClone via JSON round-trip — sufficient for Vega-Lite specs which are
 * always plain JSON. Does not preserve undefined, Date, or class instances.
 */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Strip any locked keys from a composer-provided encoding channel object,
 * preserving the template values for those keys.
 *
 * @param templateChannel  The channel object from the template (source of truth for locked keys).
 * @param incomingChannel  A channel object that may contain overrides (dropped silently).
 * @returns Merged channel with locked keys from template, non-locked from incoming.
 */
function mergeEncodingChannel(
  templateChannel: Record<string, unknown>,
  incomingChannel: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...incomingChannel };
  for (const lockedKey of LOCKED_ENCODING_CHANNEL_KEYS) {
    if (lockedKey in templateChannel) {
      merged[lockedKey] = templateChannel[lockedKey];
    } else {
      delete merged[lockedKey];
    }
  }
  return merged;
}

/**
 * Assemble a final Vega-Lite spec from a template + a StoryCard.
 *
 * @param templateSpec  The raw Vega-Lite spec from corpus.chart_templates
 *                      (accessed via JSON column; must be an object).
 * @param card          The StoryCard whose title/data_ref/body populate slots.
 * @returns             A new spec object ready to pass to vega-embed.
 *                      Returns null if templateSpec is not a valid object.
 */
export function assembleStorySpec(
  templateSpec: Record<string, unknown> | null | undefined,
  card: Pick<StoryCard, "title" | "data_ref" | "body">,
): Record<string, unknown> | null {
  if (!templateSpec || typeof templateSpec !== "object") {
    return null;
  }

  // Deep clone so the original template is never mutated.
  const spec = deepClone(templateSpec) as VegaLiteSpec;

  // --- Slot: title ---
  spec.title = card.title;

  // --- Slot: data.name (named data source binding) ---
  // The template may have a data object already; we only set/replace `name`.
  if (typeof spec.data === "object" && spec.data !== null) {
    spec.data = { ...spec.data, name: card.data_ref };
  } else {
    spec.data = { name: card.data_ref };
  }

  // --- Slot: description (optional prose annotation) ---
  if (card.body) {
    spec.description = card.body.slice(0, 280);
  } else {
    delete spec.description;
  }

  // --- Enforce locked top-level keys ---
  // The loop below is intentionally a no-op for normal operation:
  // since we started from deepClone(template), the locked values are already
  // correct. This guard matters only if a future code path somehow modifies
  // the spec before reaching this point — it re-asserts template authority.
  for (const lockedKey of LOCKED_TOP_LEVEL) {
    if (lockedKey in templateSpec) {
      (spec as Record<string, unknown>)[lockedKey] =
        deepClone((templateSpec as Record<string, unknown>)[lockedKey]);
    }
  }

  // --- Enforce locked encoding channels ---
  // If the template has encoding, ensure no locked field/type keys have been
  // altered. We merge the template encoding channels back over any changes.
  if (
    typeof templateSpec.encoding === "object" &&
    templateSpec.encoding !== null &&
    typeof spec.encoding === "object" &&
    spec.encoding !== null
  ) {
    const templateEncoding = templateSpec.encoding as Record<
      string,
      Record<string, unknown>
    >;
    const specEncoding = spec.encoding as Record<
      string,
      Record<string, unknown>
    >;
    for (const channel of Object.keys(templateEncoding)) {
      if (
        typeof templateEncoding[channel] === "object" &&
        templateEncoding[channel] !== null
      ) {
        specEncoding[channel] = mergeEncodingChannel(
          templateEncoding[channel],
          typeof specEncoding[channel] === "object" &&
            specEncoding[channel] !== null
            ? specEncoding[channel]
            : {},
        );
      }
    }
  }

  return spec as Record<string, unknown>;
}
