// Fire & Emergency Response data fetchers
// Edmonton Fire Rescue (Socrata SODA), CWFIS Active Fires (CSV), 511 Alberta Alerts (JSON)
// No authentication required for any endpoint

// ============================================================
// ENDPOINTS
// ============================================================

export const FIRE_ENDPOINTS = {
  // Edmonton Fire Rescue Services — Socrata SODA API
  // ~927K records from 2015-present, daily updates
  EDMONTON_FIRE: "https://data.edmonton.ca/resource/7hsn-idqi.json",

  // Canadian Wildland Fire Information System — active fires CSV
  // Updated daily during fire season
  CWFIS_ACTIVE_FIRES:
    "https://cwfis.cfs.nrcan.gc.ca/downloads/activefires/activefires.csv",

  // 511 Alberta road/emergency alerts — JSON API
  // Rate limit: 10 requests per 60 seconds
  ALBERTA_511_ALERTS: "https://511.alberta.ca/api/v2/get/alerts?format=json",
} as const;

// ============================================================
// TYPES
// ============================================================

export interface EdmontonFireIncident {
  eventNumber: string;
  dispatchYear: number;
  dispatchMonth: number;
  dispatchDay: number;
  dispatchDatetime: string;
  eventCloseDatetime: string;
  eventDurationMins: number;
  eventTypeGroup: string;
  eventDescription: string;
  neighbourhoodId: string;
  neighbourhoodName: string;
  approximateLocation: string;
  equipmentAssigned: string;
  latitude: number;
  longitude: number;
  responseCode: string;
}

export interface ActiveFireCWFIS {
  agency: string;
  fireName: string;
  lat: number;
  lon: number;
  startDate: string;
  hectares: number;
  stageOfControl: string; // OC, BH, UC, EX
  timezone: string;
  responseType: string;
}

export interface AlbertaAlert {
  id: string;
  message: string;
  notes: string;
  startTime: number; // unix ms
  endTime: number; // unix ms
  regions: string[];
  highImportance: boolean;
}

export interface FireIncidentSummary {
  eventType: string;
  count: number;
  avgDuration: number;
}

// ============================================================
// CSV PARSER (for CWFIS)
// ============================================================

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === ",") {
      current.push(field.trim());
      field = "";
      i++;
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      current.push(field.trim());
      field = "";
      if (current.length > 1 || current[0] !== "") {
        rows.push(current);
      }
      current = [];
      if (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
        i++;
      }
      i++;
      continue;
    }

    field += ch;
    i++;
  }

  if (field || current.length > 0) {
    current.push(field.trim());
    if (current.length > 1 || current[0] !== "") {
      rows.push(current);
    }
  }

  if (rows.length < 2) return [];

  const headers = rows[0];
  const results: Record<string, string>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c] ?? "";
    }
    results.push(obj);
  }

  return results;
}

// ============================================================
// HELPER
// ============================================================

function num(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// ============================================================
// EDMONTON FIRE FETCHERS
// ============================================================

/**
 * Fetches the most recent Edmonton fire/EMS incidents.
 * Uses Socrata SoQL to order by dispatch_datetime DESC.
 */
export async function fetchEdmontonFireRecent(
  limit: number = 1000
): Promise<EdmontonFireIncident[]> {
  try {
    const url = `${FIRE_ENDPOINTS.EDMONTON_FIRE}?$order=dispatch_datetime DESC&$limit=${limit}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error(
        `Edmonton fire fetch failed: ${res.status} ${res.statusText}`
      );
      return [];
    }
    const data = await res.json();
    return (data as Record<string, string>[]).map(mapEdmontonRecord);
  } catch (err) {
    console.error("Edmonton fire fetch error:", err);
    return [];
  }
}

/**
 * Fetches Edmonton fire incidents aggregated by event_type_group.
 * Uses Socrata SoQL GROUP BY for server-side aggregation.
 */
export async function fetchEdmontonFireByType(): Promise<FireIncidentSummary[]> {
  try {
    const url = `${FIRE_ENDPOINTS.EDMONTON_FIRE}?$select=event_type_group,count(*) as count,avg(event_duration_mins) as avg_duration&$group=event_type_group&$order=count DESC`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error(
        `Edmonton fire by-type fetch failed: ${res.status} ${res.statusText}`
      );
      return [];
    }
    const data = await res.json();
    return (data as Record<string, string>[]).map((row) => ({
      eventType: row.event_type_group || "Unknown",
      count: num(row.count),
      avgDuration: Math.round(num(row.avg_duration) * 10) / 10,
    }));
  } catch (err) {
    console.error("Edmonton fire by-type fetch error:", err);
    return [];
  }
}

/**
 * Fetches top neighbourhoods by Edmonton fire/EMS incident count.
 * Uses Socrata SoQL GROUP BY for server-side aggregation.
 */
export async function fetchEdmontonFireByNeighbourhood(
  limit: number = 25
): Promise<
  { neighbourhoodName: string; count: number; topEventType: string }[]
> {
  try {
    const url = `${FIRE_ENDPOINTS.EDMONTON_FIRE}?$select=neighbourhood_name,count(*) as count&$group=neighbourhood_name&$order=count DESC&$limit=${limit}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error(
        `Edmonton fire by-neighbourhood fetch failed: ${res.status} ${res.statusText}`
      );
      return [];
    }
    const data = (await res.json()) as Record<string, string>[];

    // For each top neighbourhood, fetch the most common event type
    const results = data
      .filter((row) => row.neighbourhood_name)
      .map((row) => ({
        neighbourhoodName: row.neighbourhood_name,
        count: num(row.count),
        topEventType: "", // Will be enriched below if possible
      }));

    // Enrich top 15 with most common event type (single batch query)
    if (results.length > 0) {
      const top15 = results.slice(0, 15);
      const enrichPromises = top15.map(async (item) => {
        try {
          const typeUrl = `${FIRE_ENDPOINTS.EDMONTON_FIRE}?$select=event_type_group,count(*) as count&$where=neighbourhood_name='${encodeURIComponent(item.neighbourhoodName).replace(/'/g, "''")}'&$group=event_type_group&$order=count DESC&$limit=1`;
          const typeRes = await fetch(typeUrl, { next: { revalidate: 3600 } });
          if (typeRes.ok) {
            const typeData = (await typeRes.json()) as Record<string, string>[];
            if (typeData.length > 0) {
              item.topEventType = typeData[0].event_type_group || "";
            }
          }
        } catch {
          // Silently fail enrichment
        }
      });
      await Promise.all(enrichPromises);
    }

    return results;
  } catch (err) {
    console.error("Edmonton fire by-neighbourhood fetch error:", err);
    return [];
  }
}

/**
 * Fetches monthly incident counts for Edmonton fire/EMS.
 * Uses Socrata SoQL GROUP BY dispatch_year, dispatch_month.
 */
export async function fetchEdmontonFireMonthlyTrend(
  years: number = 3
): Promise<{ date: string; value: number }[]> {
  try {
    const cutoffYear = new Date().getFullYear() - years;
    const url = `${FIRE_ENDPOINTS.EDMONTON_FIRE}?$select=dispatch_year,dispatch_month,count(*) as count&$where=dispatch_year>=${cutoffYear}&$group=dispatch_year,dispatch_month&$order=dispatch_year,dispatch_month`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error(
        `Edmonton fire monthly trend fetch failed: ${res.status} ${res.statusText}`
      );
      return [];
    }
    const data = (await res.json()) as Record<string, string>[];
    return data.map((row) => {
      const year = row.dispatch_year;
      const month = String(row.dispatch_month).padStart(2, "0");
      return {
        date: `${year}-${month}-01`,
        value: num(row.count),
      };
    });
  } catch (err) {
    console.error("Edmonton fire monthly trend fetch error:", err);
    return [];
  }
}

// ============================================================
// CWFIS ACTIVE FIRES FETCHER
// ============================================================

/**
 * Fetches active wildfire data from CWFIS.
 * Downloads the full CSV and filters to Alberta (agency = "ab").
 */
export async function fetchCWFISActiveFires(): Promise<ActiveFireCWFIS[]> {
  try {
    const res = await fetch(FIRE_ENDPOINTS.CWFIS_ACTIVE_FIRES, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.error(
        `CWFIS fetch failed: ${res.status} ${res.statusText}`
      );
      return [];
    }
    const text = await res.text();
    const rows = parseCsv(text);

    // Filter to Alberta fires only
    return rows
      .filter(
        (row) =>
          (row.agency || "").toLowerCase() === "ab" ||
          (row.Agency || "").toLowerCase() === "ab"
      )
      .map((row) => ({
        agency: row.agency || row.Agency || "",
        fireName: row.firename || row.Firename || row.fire_name || "",
        lat: num(row.lat || row.Lat || row.latitude),
        lon: num(row.lon || row.Lon || row.longitude),
        startDate: row.startdate || row.StartDate || row.start_date || "",
        hectares: num(row.hectares || row.Hectares),
        stageOfControl:
          row.stage_of_control ||
          row.Stage_of_Control ||
          row.stageofcontrol ||
          "",
        timezone: row.timezone || row.Timezone || "",
        responseType:
          row.response_type || row.Response_Type || row.responsetype || "",
      }));
  } catch (err) {
    console.error("CWFIS fetch error:", err);
    return [];
  }
}

// ============================================================
// 511 ALBERTA ALERTS FETCHER
// ============================================================

/**
 * Fetches current 511 Alberta alerts.
 * Uses a shorter revalidation (5 min) since alerts change frequently.
 */
export async function fetch511Alerts(): Promise<AlbertaAlert[]> {
  try {
    const res = await fetch(FIRE_ENDPOINTS.ALBERTA_511_ALERTS, {
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.error(
        `511 Alberta fetch failed: ${res.status} ${res.statusText}`
      );
      return [];
    }
    const data = await res.json();

    // The API may return an array directly or wrapped in an object
    const alerts = Array.isArray(data) ? data : data.alerts || data.data || [];

    return alerts.map(
      (alert: Record<string, unknown>) => ({
        id: String(alert.Id || alert.id || ""),
        message: String(alert.Message || alert.message || ""),
        notes: String(alert.Notes || alert.notes || ""),
        startTime: Number(alert.StartTime || alert.startTime || 0),
        endTime: Number(alert.EndTime || alert.endTime || 0),
        regions: Array.isArray(alert.Regions || alert.regions)
          ? (alert.Regions || alert.regions) as string[]
          : [],
        highImportance: Boolean(
          alert.HighImportance || alert.highImportance || false
        ),
      })
    );
  } catch (err) {
    console.error("511 Alberta fetch error:", err);
    return [];
  }
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

function mapEdmontonRecord(
  row: Record<string, string>
): EdmontonFireIncident {
  return {
    eventNumber: row.event_number || "",
    dispatchYear: num(row.dispatch_year),
    dispatchMonth: num(row.dispatch_month),
    dispatchDay: num(row.dispatch_day),
    dispatchDatetime: row.dispatch_datetime || "",
    eventCloseDatetime: row.event_close_datetime || "",
    eventDurationMins: num(row.event_duration_mins),
    eventTypeGroup: row.event_type_group || "",
    eventDescription: row.event_description || "",
    neighbourhoodId: row.neighbourhood_id || "",
    neighbourhoodName: row.neighbourhood_name || "",
    approximateLocation: row.approximate_location || "",
    equipmentAssigned: row.equipment_assigned || "",
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    responseCode: row.response_code || "",
  };
}
