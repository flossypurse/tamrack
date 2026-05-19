export const SITE_URL = "https://tamrack.ca" as const;
export const SITE_NAME = "Tamrack" as const;
export const SITE_NAME_SHORT = "Tamrack" as const;

// NOTE: Phase A3 flipped these defaults from "Alberta Pulse Check" to "Tamrack".
// The env var fallback chain still wins at runtime; these are forward-looking
// defaults for tamrack.ca. DNS cutover is Phase C.
