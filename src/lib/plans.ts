// Shared plan/feature data — consumed by /pricing and /billing.
// Keep in sync with Stripe product/price configuration.

export const chartsFeatures = [
  "Browse 110+ live data charts",
  "Embed any chart on your website",
  "Share via link, X, or LinkedIn",
  "Filter by category and keyword",
  "SEO-friendly permalink pages",
  "No account required",
];

export const edoFeatures = [
  "Dedicated dashboard for your municipality",
  "Community profile generator (PDF export)",
  "Peer municipality comparison (2-5 at once)",
  "Automated trend alerts dashboard",
  "Council-ready report templates",
  "Investment pitch kit builder",
  "Priority support",
];

export const realEstateFeatures = [
  "Market intelligence dashboard",
  "Development permit tracking & alerts",
  "Neighbourhood deep-dive reports",
  "Listing presentation data packs",
  "Assessment trend analysis",
  "Client-ready PDF exports",
];

export const learnFeatures = [
  "8-module Alberta economics course",
  "Interactive quizzes with live data",
  "Embedded Pulse Charts in every lesson",
  "Certificate of completion",
  "Shareable on LinkedIn",
  "No account required to start",
];

// Condensed free-tier list used on /billing — top highlights from the
// $0 products (Pulse Charts + Pulse Learn), not a full dupe of the
// /pricing comparison. See /pricing for the full breakdown.
export const freeTierHighlights = [
  "Browse 110+ live data charts",
  "Embed & share any chart",
  "Public municipality pages (32 Alberta munis)",
  "Pulse Learn — 8-module Alberta economics course",
];
