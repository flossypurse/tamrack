// Shared CSV utilities for parsing remote CSV files.
// Extracted from data-sources-ircc.ts for reuse across politics, fiscal, and immigration modules.

/**
 * Fetch a remote CSV file and parse it into an array of key-value records.
 * Headers from the first row become keys; all values are strings.
 * Returns [] on any error — never throws.
 */
export async function fetchCSV(
  url: string,
  revalidate: number = 86400
): Promise<Record<string, string>[]> {
  try {
    const res = await fetch(url, {
      next: { revalidate },
    });
    if (!res.ok) {
      console.error(
        `[csv] fetch failed: ${res.status} ${res.statusText} for ${url}`
      );
      return [];
    }
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
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

/** Parse a single CSV line, handling quoted fields with embedded commas and escaped quotes. */
export function parseCSVLine(line: string): string[] {
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
      } else if (ch === ",") {
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
