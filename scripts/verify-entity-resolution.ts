// Verify the entity resolver: seed operators + named-feed rows, resolve, assert.
import { getDb } from "../src/lib/db";
import {
  normalizeBusinessName,
  getOperatorSignals,
  resolveAllOperators,
} from "../src/lib/entity-resolution";
import { randomUUID } from "crypto";

let pass = 0;
const fail: string[] = [];
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { console.log(`  PASS  ${name}`); pass++; }
  else { console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); fail.push(name); }
}

async function main() {
  const pool = await getDb();

  // normalization unit checks
  ok("normalize strips legal suffix", normalizeBusinessName("North Face Mechanical Ltd.") === "north face mechanical");
  ok("normalize expands & + drops punctuation", normalizeBusinessName("Bedard & Lee, Inc.") === "bedard and lee");

  const opA = randomUUID(), opB = randomUUID(), opC = randomUUID(), opD = randomUUID();
  const mkOp = async (id: string, name: string, city: string) =>
    pool.query(
      `INSERT INTO intel_operators (id, source, source_member_id, name, city) VALUES ($1::uuid,'test',$2,$3,$4)`,
      [id, id, name, city],
    );
  await mkOp(opA, "North Face Mechanical Ltd.", "Spruce Grove");
  await mkOp(opB, "Prairie Creek Energy Services Ltd", "Stony Plain");
  await mkOp(opC, "Bedard Lee and Associates", "Spruce Grove");
  await mkOp(opD, "Totally Unmatched Widgets Co", "Devon");

  // business licence (edmonton) — same-city corroboration
  await pool.query(
    `INSERT INTO business_licences (source, licence_id, trade_name, city, category, status, issue_date)
     VALUES ('edmonton','E-1','North Face Mechanical','Spruce Grove','HVAC Contractor','ISSUED','2010-03-01')`,
  );
  // well licences — licensee match
  for (let i = 0; i < 3; i++) {
    await pool.query(
      `INSERT INTO well_licences (licence_number, well_name, licensee, substance, classification, surface_location, filing_date)
       VALUES ($1,$2,'Prairie Creek Energy Services Ltd','Crude Oil','New','04-12-055-08','2025-1${i}-01')`,
      [`W-${i}`, `Well ${i}`],
    );
  }
  // federal contract — vendor match
  await pool.query(
    `INSERT INTO fiscal_federal_contracts (vendor, department, description, contract_date, value, province)
     VALUES ('Bedard Lee and Associates','PSPC','Audit services','2025-09-01',82000,'Alberta')`,
  );

  const sA = await getOperatorSignals({ id: opA, name: "North Face Mechanical Ltd.", city: "Spruce Grove" });
  ok("A resolves business licence", sA.business_licence != null && sA.business_licence.source === "edmonton", JSON.stringify(sA.business_licence));
  ok("A licence carries category + since", sA.business_licence?.category === "HVAC Contractor" && sA.business_licence?.since === "2010-03-01");
  ok("A resolved_sources includes edmonton_licence", sA.resolved_sources.includes("edmonton_licence"));

  const sB = await getOperatorSignals({ id: opB, name: "Prairie Creek Energy Services Ltd", city: "Stony Plain" });
  ok("B resolves well activity (3 licences)", sB.well_activity?.licences === 3, JSON.stringify(sB.well_activity));
  ok("B well substances captured", (sB.well_activity?.substances ?? []).includes("Crude Oil"));

  const sC = await getOperatorSignals({ id: opC, name: "Bedard Lee and Associates", city: "Spruce Grove" });
  ok("C resolves federal contract ($82k)", sC.federal_contracts?.total_value_cad === 82000, JSON.stringify(sC.federal_contracts));

  const sD = await getOperatorSignals({ id: opD, name: "Totally Unmatched Widgets Co", city: "Devon" });
  ok("D resolves nothing (no false positives)", sD.resolved_sources.length === 0, JSON.stringify(sD.resolved_sources));

  // persistence pass
  const resolved = await resolveAllOperators("2026-06-10");
  ok("resolveAllOperators counts 3 resolved", resolved === 3, `got ${resolved}`);
  const { rows } = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM signals.operator_aliases`);
  ok("operator_aliases persisted (>=3)", Number(rows[0].n) >= 3, `got ${rows[0].n}`);

  console.log(`\n${pass} passed, ${fail.length} failed`);
  process.exit(fail.length ? 1 : 0);
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
