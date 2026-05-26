// Shared CSV/TSV utilities for parsing remote tabular files.
// Extracted from data-sources-ircc.ts for reuse across politics, fiscal, and immigration modules.

export interface FetchCSVOptions {
  revalidate?: number;
  /** Delimiter character. Defaults to auto-detect from the header line (tab if more tabs than commas, else comma). */
  delimiter?: "," | "\t";
}

/**
 * Fetch a remote tabular file (CSV or TSV) and parse it into an array of key-value records.
 * Headers from the first row become keys; all values are strings.
 * Returns [] on any error — never throws.
 */
export async function fetchCSV(
  url: string,
  options: number | FetchCSVOptions = {}
): Promise<Record<string, string>[]> {
  // Back-compat: callers used to pass a number for `revalidate`.
  const opts: FetchCSVOptions =
    typeof options === "number" ? { revalidate: options } : options;
  const revalidate = opts.revalidate ?? 86400;

  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) {
      console.error(
        `[csv] fetch failed: ${res.status} ${res.statusText} for ${url}`
      );
      return [];
    }
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const delimiter = opts.delimiter ?? detectDelimiter(lines[0]);
    const headers = parseDelimitedLine(lines[0], delimiter);
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseDelimitedLine(lines[i], delimiter);
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j].trim()] = (values[j] ?? "").trim();
      }
      rows.push(row);
    }
    return rows;
  } catch (err) {
    console.error(`[csv] fetch error for ${url}:`, err);
    return [];
  }
}

/** Sniff the delimiter from a header line by counting tabs vs commas. */
export function detectDelimiter(header: string): "," | "\t" {
  const tabs = (header.match(/\t/g) ?? []).length;
  const commas = (header.match(/,/g) ?? []).length;
  return tabs > commas ? "\t" : ",";
}

/**
 * Parse a single line with the given delimiter, handling quoted fields
 * with embedded delimiters and escaped quotes.
 */
export function parseDelimitedLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

/** Back-compat alias — original name split on comma only. New code should use parseDelimitedLine. */
export function parseCSVLine(line: string): string[] {
  return parseDelimitedLine(line, ",");
}
