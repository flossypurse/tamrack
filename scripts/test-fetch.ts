#!/usr/bin/env npx tsx
/**
 * Quick smoke-test harness for individual fetchers.
 * Usage:  cd webui && npx tsx scripts/test-fetch.ts <fetcher>
 *
 * Available fetchers:
 *   major-projects | immigration | crude-oil | aer-wells
 */

import { fetchAlbertaMajorProjects } from "../src/lib/data-sources-infrastructure";
import {
  fetchImmigrationByCategory,
  fetchImmigrationByCMA,
} from "../src/lib/data-sources-ircc";
import { fetchCrudeOilProduction } from "../src/lib/data-sources-cer";
import { fetchJobBankPostings, resolveLatestJobBankMonth } from "../src/lib/data-sources-jobbank";

async function main() {
  const which = process.argv[2] ?? "major-projects";

  switch (which) {
    case "major-projects": {
      const rows = await fetchAlbertaMajorProjects();
      console.log("rows:", rows.length);
      console.log("with cost > 0:", rows.filter((r) => r.cost > 0).length);
      console.log("with stage:", rows.filter((r) => r.stage).length);
      console.log("with municipality:", rows.filter((r) => r.municipality).length);
      console.log("with sector:", rows.filter((r) => r.sector).length);
      console.log("first 3:");
      console.log(JSON.stringify(rows.slice(0, 3), null, 2));
      break;
    }
    case "immigration": {
      const byCat = await fetchImmigrationByCategory("Alberta");
      console.log("byCategory rows:", byCat.length);
      console.log("byCategory sample:", JSON.stringify(byCat.slice(0, 3), null, 2));
      const byCma = await fetchImmigrationByCMA("Edmonton");
      console.log("byCMA(Edmonton) rows:", byCma.length);
      console.log("byCMA sample:", JSON.stringify(byCma.slice(0, 3), null, 2));
      break;
    }
    case "crude-oil": {
      const rows = await fetchCrudeOilProduction();
      console.log("rows:", rows.length);
      console.log("distinct provinces:", [...new Set(rows.map((r) => r.province))]);
      console.log("first 3:", JSON.stringify(rows.slice(0, 3), null, 2));
      break;
    }
    case "jobbank": {
      const month = await resolveLatestJobBankMonth();
      const all = await fetchJobBankPostings({ province: "Alberta", tierBOnly: false });
      const tierB = all.filter((p) => !!p.matchedNocCode);
      console.log("data month:", month);
      console.log("total Alberta postings:", all.length);
      console.log("Tier-B (automatable-role) postings:", tierB.length);
      const byNoc: Record<string, number> = {};
      const byCity: Record<string, number> = {};
      for (const p of tierB) {
        byNoc[p.matchedNocName] = (byNoc[p.matchedNocName] || 0) + 1;
        byCity[p.city || "Not stated"] = (byCity[p.city || "Not stated"] || 0) + 1;
      }
      console.log("top NOC roles:", Object.entries(byNoc).sort((a, b) => b[1] - a[1]).slice(0, 8));
      console.log("top cities:", Object.entries(byCity).sort((a, b) => b[1] - a[1]).slice(0, 6));
      console.log("sample rows:", JSON.stringify(tierB.slice(0, 3).map((p) => ({ title: p.jobTitle, noc: p.matchedNocName, city: p.city, sector: p.naicsSector, posted: p.firstPostingDate })), null, 2));
      break;
    }
    default:
      console.error("Unknown fetcher:", which);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
