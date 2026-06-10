/**
 * Verification script for the politics vertical.
 *
 * Boots the DDL, seeds synthetic rows for each politics table, calls the
 * read functions, and asserts shape + row count. Exits 0 on success.
 *
 * Run:
 *   DATABASE_URL="postgresql://postgres@127.0.0.1:54399/tamrack_verify_politics" \
 *     npx tsx scripts/verify-politics.ts
 */

import { getDb } from "../src/lib/db";
import {
  readMLAs,
  readMPs,
  readVotes,
  readElectoralDistricts,
} from "../src/lib/collect-politics";

async function main(): Promise<void> {
  console.log("[verify-politics] booting DDL…");
  const pool = await getDb();
  console.log("[verify-politics] DDL applied OK");

  // -----------------------------------------------------------------------
  // Seed synthetic rows directly via SQL (skips live upstream fetches)
  // -----------------------------------------------------------------------

  // MLAs
  await pool.query(`
    INSERT INTO politics_mlas (name, party, district, email, url, photo_url, office)
    VALUES
      ('Alice Redwater',  'United Conservative Party', 'Redwater',  'alice@test.ab.ca', 'https://example.com/alice', '', 'MLA'),
      ('Bob Lacombe',     'New Democratic Party',       'Lacombe',   'bob@test.ab.ca',   'https://example.com/bob',   '', 'MLA'),
      ('Carol Pincher',   'United Conservative Party', 'Pincher Creek', 'carol@test.ab.ca', '', '', 'MLA')
    ON CONFLICT (name, district) DO UPDATE SET party = EXCLUDED.party
  `);

  // MPs
  await pool.query(`
    INSERT INTO politics_mps (name, party, riding, province, email, url, photo_url)
    VALUES
      ('Dan Carrot',   'Conservative Party of Canada', 'Carrot River Valley', 'Alberta', 'dan@fed.ca',   'https://example.com/dan',   ''),
      ('Eve Ponoka',   'New Democratic Party',          'Ponoka-Hanna',       'Alberta', 'eve@fed.ca',   'https://example.com/eve',   '')
    ON CONFLICT (name, riding) DO UPDATE SET party = EXCLUDED.party
  `);

  // Electoral districts
  await pool.query(`
    INSERT INTO politics_electoral_districts (name, external_id, boundary_url)
    VALUES
      ('Redwater',       'redwater-ed',       'https://represent.opennorth.ca/boundaries/alberta-electoral-districts-2017/redwater/'),
      ('Lacombe-Ponoka', 'lacombe-ponoka-ed', 'https://represent.opennorth.ca/boundaries/alberta-electoral-districts-2017/lacombe-ponoka/')
    ON CONFLICT (external_id) DO UPDATE SET name = EXCLUDED.name
  `);

  // Votes
  await pool.query(`
    INSERT INTO politics_votes (vote_url, session, number, vote_date, yea, nay, paired, result, bill_url, description)
    VALUES
      ('/votes/44-1/1/', '44-1', 1, '2021-12-01', 200, 118, 0, 'Agreed To', '', 'Allocation of Time — Bill C-2'),
      ('/votes/44-1/2/', '44-1', 2, '2021-12-02', 177, 145, 2, 'Agreed To', '/bills/44-1/C-5/', 'Second reading of Bill C-5'),
      ('/votes/44-1/3/', '44-1', 3, '2021-12-03', 140, 180, 1, 'Negatived', '', 'Opposition motion re: housing')
    ON CONFLICT (session, number) DO UPDATE SET result = EXCLUDED.result
  `);

  console.log("[verify-politics] seed rows inserted");

  // -----------------------------------------------------------------------
  // Read and assert
  // -----------------------------------------------------------------------

  let pass = 0;
  let fail = 0;

  function assert(label: string, condition: boolean): void {
    if (condition) {
      console.log(`  PASS  ${label}`);
      pass++;
    } else {
      console.error(`  FAIL  ${label}`);
      fail++;
    }
  }

  // MLAs
  const mlas = await readMLAs();
  assert("readMLAs returns 3 rows", mlas.length === 3);
  assert("mlas sorted by district then name", mlas[0].district <= mlas[1].district);
  assert("mla row has name", typeof mlas[0].name === "string" && mlas[0].name.length > 0);
  assert("mla row has party", typeof mlas[0].party === "string");
  assert("mla row has district", typeof mlas[0].district === "string");
  assert("mla row has email", typeof mlas[0].email === "string");
  assert("mla row has url", typeof mlas[0].url === "string");

  // MPs
  const mps = await readMPs();
  assert("readMPs returns 2 rows", mps.length === 2);
  assert("mp row has name", typeof mps[0].name === "string" && mps[0].name.length > 0);
  assert("mp row has riding", typeof mps[0].riding === "string");
  assert("mp row has province", mps[0].province === "Alberta");

  // Votes (no limit override — should default to 25, capped at 3 rows in DB)
  const votes = await readVotes();
  assert("readVotes returns 3 rows (all stored)", votes.length === 3);
  assert("votes sorted by date desc", votes[0].vote_date >= votes[1].vote_date);
  assert("vote row has session", typeof votes[0].session === "string");
  assert("vote row has number (int)", Number.isInteger(votes[0].number));
  assert("vote row has yea (int)", Number.isInteger(votes[0].yea));
  assert("vote row has nay (int)", Number.isInteger(votes[0].nay));
  assert("vote row has result", typeof votes[0].result === "string");

  // Votes with limit
  const votesLimited = await readVotes(1);
  assert("readVotes(1) returns exactly 1 row", votesLimited.length === 1);

  // Electoral districts
  const districts = await readElectoralDistricts();
  assert("readElectoralDistricts returns 2 rows", districts.length === 2);
  assert("district row has name", typeof districts[0].name === "string" && districts[0].name.length > 0);
  assert("district row has external_id", typeof districts[0].external_id === "string");
  assert("district row has boundary_url", typeof districts[0].boundary_url === "string");

  // snapshot_log exists (DDL created it)
  const logRes = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'snapshot_log'
     ) AS exists`
  );
  assert("snapshot_log table exists", logRes.rows[0].exists === true);

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log(`\n[verify-politics] ${pass} passed, ${fail} failed`);

  await pool.end();

  if (fail > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[verify-politics] FATAL:", err);
  process.exit(1);
});
