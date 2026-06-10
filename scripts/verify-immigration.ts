// Local verification runner for the immigration read path.
// Boots schema via getDb(), seeds a few rows, exercises the read helpers.
import {
  getDb,
  upsertImmigrationRecord,
  getImmigrationTimeSeries,
  getImmigrationByCategory,
  getImmigrationByCMA,
} from "../src/lib/db";

async function main() {
  await getDb(); // runs boot-DDL (creates immigration_records)

  // Province-level category rows (cma = '')
  await upsertImmigrationRecord(2023, 0, "Alberta", "Economic", "", 100);
  await upsertImmigrationRecord(2023, 0, "Alberta", "Family", "", 40);
  await upsertImmigrationRecord(2024, 0, "Alberta", "Economic", "", 150);
  await upsertImmigrationRecord(2024, 0, "Alberta", "Family", "", 55);
  await upsertImmigrationRecord(2024, 0, "Alberta", "Refugee", "", 20);
  // CMA rows (category = '')
  await upsertImmigrationRecord(2024, 0, "Alberta", "", "Edmonton", 90);
  await upsertImmigrationRecord(2024, 0, "Alberta", "", "Calgary", 110);

  const ts = await getImmigrationTimeSeries("Alberta");
  const cat = await getImmigrationByCategory("Alberta");
  const cma = await getImmigrationByCMA();

  console.log("timeseries:", JSON.stringify(ts));
  console.log("by_category (latest year):", JSON.stringify(cat));
  console.log("by_cma (latest year):", JSON.stringify(cma));

  // Assertions
  const ok: string[] = [];
  const ts2024 = ts.find((r) => Number(r.year) === 2024);
  if (ts2024 && Number(ts2024.total) === 225) ok.push("timeseries 2024 total=225 ✓");
  else throw new Error(`timeseries 2024 expected 225, got ${JSON.stringify(ts2024)}`);
  if (cat.length === 3 && cat[0].category === "Economic" && cat[0].total === 150)
    ok.push("by_category latest=2024, Economic top=150 ✓");
  else throw new Error(`by_category unexpected: ${JSON.stringify(cat)}`);
  if (cma.length === 2 && cma[0].cma === "Calgary" && cma[0].total === 110)
    ok.push("by_cma Calgary top=110 ✓");
  else throw new Error(`by_cma unexpected: ${JSON.stringify(cma)}`);

  console.log("\nALL ASSERTIONS PASSED:\n  " + ok.join("\n  "));
  process.exit(0);
}

main().catch((e) => {
  console.error("VERIFY FAILED:", e);
  process.exit(1);
});
