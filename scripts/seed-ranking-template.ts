/**
 * Seed the Ranking story template into corpus.chart_templates.
 *
 * Idempotent: uses INSERT ... ON CONFLICT (slug) DO UPDATE so re-running
 * is safe on a live database.
 *
 * LOCKED PROPERTIES — the renderer's assembleStorySpec() enforces these
 * by deep-cloning the template spec and only allowing slot fills for
 * `title`, `data`, and annotations.  The properties marked NON_MODIFIABLE
 * below must never be changed at render time by the composer:
 *   - mark.type
 *   - encoding.y.field / encoding.y.type / encoding.y.sort
 *   - encoding.x.field / encoding.x.type
 *   - transform (field alias must match encoding references)
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/seed-ranking-template.ts
 */

import { getDb } from "@/lib/db";

// ---------------------------------------------------------------------------
// Vega-Lite partial for the Ranking template.
//
// Slot contract (composer fills these at render time):
//   spec.title          — active title string ("Strathcona leads…")
//   spec.data.values    — array of { label: string; value: number } records
//   spec.layer[1].encoding.text.value   — annotation text (optional)
//
// NON_MODIFIABLE (renderer enforces, composer must NOT write):
//   mark / mark.type
//   encoding.y.field, encoding.y.type, encoding.y.sort
//   encoding.x.field, encoding.x.type
//   transform[].as
// ---------------------------------------------------------------------------

const RANKING_SPEC = {
  $schema: "https://vega.github.io/schema/vega-lite/v5.json",
  // NON_MODIFIABLE: width is "container" for responsive client-only render
  width: "container",
  height: { step: 28 },
  // Composer fills: title (active-voice conclusion string)
  title: {
    text: "{{title}}",
    anchor: "start",
    fontWeight: "bold",
    fontSize: 13,
  },
  // Composer fills: data.values as [{ label: string; value: number }, ...]
  data: { values: [] },
  // NON_MODIFIABLE: transform aliases must match encoding field references
  transform: [
    { window: [{ op: "rank", as: "rank" }], sort: [{ field: "value", order: "descending" }] },
    { filter: "datum.rank <= 20" },
  ],
  layer: [
    {
      // NON_MODIFIABLE: mark type is always bar for bar_ranked shape
      mark: { type: "bar", color: "#F5A623", cornerRadiusEnd: 0 },
      encoding: {
        // NON_MODIFIABLE: y is categorical label, x is numeric value
        y: {
          field: "label",
          type: "nominal",
          sort: { field: "value", order: "descending" },
          axis: {
            title: null,
            labelFontFamily: "var(--font-mono, monospace)",
            labelFontSize: 11,
            labelLimit: 200,
          },
        },
        x: {
          field: "value",
          type: "quantitative",
          axis: {
            title: "{{x_title}}",
            labelFontFamily: "var(--font-mono, monospace)",
            labelFontSize: 10,
            grid: true,
            gridOpacity: 0.15,
            tickCount: 5,
          },
        },
        tooltip: [
          { field: "label", title: "Name" },
          { field: "value", title: "{{x_title}}", format: "{{value_format}}" },
        ],
      },
    },
    {
      // Composer fills: optional annotation layer (empty values = no mark rendered)
      mark: { type: "text", align: "left", dx: 4, fontSize: 10, fontFamily: "var(--font-mono, monospace)", color: "#888" },
      encoding: {
        y: { field: "label", type: "nominal", sort: { field: "value", order: "descending" } },
        x: { field: "value", type: "quantitative" },
        // Composer fills or leaves empty
        text: { value: "" },
      },
    },
  ],
  config: {
    view: { stroke: null },
    axis: { domain: false, ticks: false },
    background: "transparent",
    font: "var(--font-mono, monospace)",
  },
};

async function main() {
  const pool = await getDb();

  const result = await pool.query<{ id: string; slug: string }>(
    `
    INSERT INTO corpus.chart_templates
      (id, slug, series_shape, unit_type, cadence, spec, tags,
       requires_human_review, template_available)
    VALUES
      (gen_random_uuid(),
       'ranking',
       'bar_ranked',
       NULL,
       NULL,
       $1::jsonb,
       ARRAY['ranking','entity-level','top-n','ordered-bar'],
       FALSE,
       TRUE)
    ON CONFLICT (slug) DO UPDATE SET
      series_shape          = EXCLUDED.series_shape,
      spec                  = EXCLUDED.spec,
      tags                  = EXCLUDED.tags,
      requires_human_review = EXCLUDED.requires_human_review,
      template_available    = EXCLUDED.template_available
    RETURNING id, slug
    `,
    [JSON.stringify(RANKING_SPEC)],
  );

  const row = result.rows[0];
  if (row) {
    console.log(JSON.stringify({ event: "seed_ranking_template", slug: row.slug, id: row.id, status: "ok" }));
  } else {
    console.error(JSON.stringify({ event: "seed_ranking_template", status: "error", detail: "no row returned" }));
    process.exit(1);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(JSON.stringify({ event: "seed_ranking_template", status: "fatal", error: String(err) }));
  process.exit(1);
});
