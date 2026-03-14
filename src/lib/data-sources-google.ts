// Google Maps Platform — Geocoding + Places API
// Free tier: 10K events/month per SKU. Budget: ~$50/mo.
// Used for: municipality geocoding, place/business counts, nearby amenities.

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";
const BASE = "https://maps.googleapis.com/maps/api";

// ============================================================
// Types
// ============================================================

export interface GeocodedLocation {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
}

export interface PlaceSummary {
  name: string;
  placeId: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
  rating?: number;
  userRatingsTotal?: number;
  businessStatus?: string;
}

export interface PlaceTypeCounts {
  municipality: string;
  counts: Record<string, number>;
}

// ============================================================
// Geocoding
// ============================================================

export async function geocodeMunicipality(
  name: string,
  province: string = "Alberta"
): Promise<GeocodedLocation | null> {
  if (!API_KEY) {
    console.warn("[google] GOOGLE_MAPS_API_KEY not configured");
    return null;
  }

  const params = new URLSearchParams({
    address: `${name}, ${province}, Canada`,
    key: API_KEY,
  });

  try {
    const res = await fetch(`${BASE}/geocode/json?${params}`, {
      next: { revalidate: 604800 }, // 7 days — municipalities don't move
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return null;

    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
    };
  } catch (err) {
    console.error(`[google] geocode error for ${name}:`, err);
    return null;
  }
}

// ============================================================
// Places — Nearby Search
// ============================================================

export async function searchNearbyPlaces(
  lat: number,
  lng: number,
  type: string,
  radius: number = 5000
): Promise<PlaceSummary[]> {
  if (!API_KEY) return [];

  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    radius: String(radius),
    type,
    key: API_KEY,
  });

  try {
    const res = await fetch(`${BASE}/place/nearbysearch/json?${params}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((p: Record<string, unknown>) => ({
      name: p.name as string,
      placeId: p.place_id as string,
      address: (p.vicinity || p.formatted_address || "") as string,
      lat: (p.geometry as Record<string, Record<string, number>>)?.location?.lat || 0,
      lng: (p.geometry as Record<string, Record<string, number>>)?.location?.lng || 0,
      types: (p.types || []) as string[],
      rating: p.rating as number | undefined,
      userRatingsTotal: p.user_ratings_total as number | undefined,
      businessStatus: p.business_status as string | undefined,
    }));
  } catch (err) {
    console.error(`[google] nearby search error:`, err);
    return [];
  }
}

// ============================================================
// Places — Text Search (more flexible than nearby)
// ============================================================

export async function searchPlaces(
  query: string,
  lat?: number,
  lng?: number,
  radius?: number
): Promise<PlaceSummary[]> {
  if (!API_KEY) return [];

  const params = new URLSearchParams({
    query,
    key: API_KEY,
  });
  if (lat && lng) {
    params.set("location", `${lat},${lng}`);
    params.set("radius", String(radius || 10000));
  }

  try {
    const res = await fetch(`${BASE}/place/textsearch/json?${params}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((p: Record<string, unknown>) => ({
      name: p.name as string,
      placeId: p.place_id as string,
      address: (p.formatted_address || "") as string,
      lat: (p.geometry as Record<string, Record<string, number>>)?.location?.lat || 0,
      lng: (p.geometry as Record<string, Record<string, number>>)?.location?.lng || 0,
      types: (p.types || []) as string[],
      rating: p.rating as number | undefined,
      userRatingsTotal: p.user_ratings_total as number | undefined,
      businessStatus: p.business_status as string | undefined,
    }));
  } catch (err) {
    console.error(`[google] text search error:`, err);
    return [];
  }
}

// ============================================================
// Convenience: Count place types in a municipality
// ============================================================

const PLACE_TYPES_OF_INTEREST = [
  "restaurant",
  "school",
  "hospital",
  "pharmacy",
  "supermarket",
  "gas_station",
  "bank",
  "gym",
  "park",
  "library",
] as const;

export async function countPlaceTypes(
  municipalityName: string,
  lat?: number,
  lng?: number
): Promise<PlaceTypeCounts> {
  // Geocode if coords not provided
  let useLat = lat;
  let useLng = lng;
  if (!useLat || !useLng) {
    const geo = await geocodeMunicipality(municipalityName);
    if (!geo) return { municipality: municipalityName, counts: {} };
    useLat = geo.lat;
    useLng = geo.lng;
  }

  const counts: Record<string, number> = {};

  // Fetch counts sequentially to stay under rate limits
  for (const type of PLACE_TYPES_OF_INTEREST) {
    const results = await searchNearbyPlaces(useLat, useLng, type, 10000);
    counts[type] = results.length;
  }

  return { municipality: municipalityName, counts };
}
