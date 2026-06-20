/**
 * Date coercion shared by the data-source fetchers and the MCP time-range
 * helper. Upstream sources (StatsCan, the regional dashboard, the Alberta
 * Activity Index XLSX) hand us dates in a zoo of shapes — bare years,
 * `YYYY-MM`, `Mon-YYYY`, quarter labels, slash dates, and Excel serial
 * numbers. Everything that surfaces through a typed MCP tool must end up as a
 * strict `YYYY-MM-DD` so the output schemas (`z.iso.date()`) can never reject
 * an otherwise-valid envelope on date shape alone.
 *
 * Kept in `src/lib` (not under the MCP app dir) so the substrate fetchers can
 * use it without an app → lib layering inversion.
 */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Zero-pad and validate a (year, month, day) triple, rejecting impossible
 * calendar dates (e.g. 2010-02-30). Returns `YYYY-MM-DD` or null. */
function formatIso(year: number, month: number, day: number): string | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  // Round-trip through UTC to reject overflow days (e.g. Feb 30 → Mar 2).
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Coerce a date-ish value to a strict `YYYY-MM-DD` anchor, or null if it can't
 * be interpreted. Monthly/quarterly/annual labels anchor to the FIRST day of
 * the period so they sort and compare consistently against full ISO dates.
 *
 * Handles:
 *   - `YYYY-MM-DD` (optionally with a time suffix) → first 10 chars
 *   - `YYYY-MM`                                    → `YYYY-MM-01`
 *   - `YYYY`                                       → `YYYY-01-01`
 *   - `YYYY-Q[1-4]` / `YYYY Q[1-4]`                → first month of the quarter
 *   - `Mon-YYYY` / `Mon YYYY` / `Month YYYY`       → `YYYY-MM-01`
 *   - `MM/DD/YYYY`                                 → ISO
 *   - Excel serial numbers (number or numeric str) → ISO
 *   - anything else `Date.parse` understands       → ISO (UTC)
 */
export function toIsoDate(input: unknown): string | null {
  if (input == null) return null;

  // Numbers: a 4-digit value is a bare year; larger values are Excel serials.
  if (typeof input === "number") {
    if (Number.isInteger(input) && input >= 1000 && input <= 9999) {
      return formatIso(input, 1, 1);
    }
    return excelSerialToIso(input);
  }

  const s = String(input).trim();
  if (!s) return null;

  // YYYY-MM-DD (allow trailing time / "T..."), normalise to the date part.
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (m) return formatIso(Number(m[1]), Number(m[2]), Number(m[3]));

  // YYYY-MM
  m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return formatIso(Number(m[1]), Number(m[2]), 1);

  // YYYY only
  m = s.match(/^(\d{4})$/);
  if (m) return formatIso(Number(m[1]), 1, 1);

  // YYYY-Q3 / YYYY Q3 / YYYYQ3
  m = s.match(/^(\d{4})[-\s]?Q([1-4])$/i);
  if (m) return formatIso(Number(m[1]), (Number(m[2]) - 1) * 3 + 1, 1);

  // Mon-YYYY / Mon YYYY / Month YYYY (e.g. "Jan-2010", "January 2010")
  m = s.match(/^([A-Za-z]{3,})[-\s](\d{4})$/);
  if (m) {
    const mon = MONTHS[m[1].slice(0, 3).toLowerCase()];
    // A word-YYYY shape that isn't a real month is junk — don't let it leak to
    // the Date.parse fallback (which would anchor "Xyz-2010" to 2010-01-01).
    return mon ? formatIso(Number(m[2]), mon, 1) : null;
  }

  // YYYY-Mon (e.g. "2010-Jan")
  m = s.match(/^(\d{4})[-\s]([A-Za-z]{3,})$/);
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    return mon ? formatIso(Number(m[1]), mon, 1) : null;
  }

  // MM/DD/YYYY (the shape the legacy XLSX parser assumed)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return formatIso(Number(m[3]), Number(m[1]), Number(m[2]));

  // Numeric string that's an Excel serial (no separators).
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n >= 1000 && n <= 9999 && Number.isInteger(n)) return formatIso(n, 1, 1);
    const iso = excelSerialToIso(n);
    if (iso) return iso;
  }

  // Last resort: let the engine try, then reformat in UTC.
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return formatIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  return null;
}

/**
 * Excel stores dates as days since 1899-12-30 (the well-known 1900 leap-year
 * bug puts the epoch there). Only accept a plausible modern range so a stray
 * count doesn't masquerade as a date.
 */
function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 10000 || serial > 80000) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000;
  const d = new Date(ms);
  return formatIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
