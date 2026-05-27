import { SITE_URL } from "@/lib/constants/site";

export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Tamrack",
    url: SITE_URL,
    description:
      "A data agent for Alberta. 180+ live feeds across 16 Alberta government sources, rendered on demand.",
    foundingDate: "2026",
    areaServed: {
      "@type": "AdministrativeArea",
      name: "Alberta, Canada",
    },
    sameAs: [
      "https://x.com/flossypurse",
      "https://bsky.app/profile/flossypurse.bsky.social",
      "https://www.linkedin.com/in/cullywakelin/",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function WebsiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Tamrack",
    url: SITE_URL,
    description:
      "A data agent for Alberta — 180+ live feeds across 16 government sources.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/charts?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function DatasetJsonLd({
  name,
  description,
  url,
  keywords,
}: {
  name: string;
  description: string;
  url: string;
  keywords: string[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name,
    description,
    url,
    keywords,
    license: `${SITE_URL}/terms`,
    creator: {
      "@type": "Organization",
      name: "Tamrack",
      url: SITE_URL,
    },
    spatialCoverage: {
      "@type": "Place",
      name: "Alberta, Canada",
    },
    isAccessibleForFree: false,
    distribution: {
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: `${SITE_URL}/api`,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function SoftwareApplicationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Tamrack",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description:
      "A data agent for Alberta — type a question, get the chart. 180+ feeds across 16 government sources.",
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "CAD",
        name: "Chart catalogue (Free)",
        description: "110+ live charts, embeds, and the 8-module Tamrack Learn course",
      },
      {
        "@type": "Offer",
        price: "9",
        priceCurrency: "CAD",
        name: "Tamrack",
        description:
          "The agent + HTTP API + MCP server. Invite-only during early access.",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "9",
          priceCurrency: "CAD",
          billingDuration: "P1M",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
