export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Alberta Pulse Check",
    url: "https://albertapulsecheck.ca",
    description:
      "Real-time economic intelligence dashboard for Alberta — live data from 8+ government sources across 22 municipalities.",
    foundingDate: "2026",
    areaServed: {
      "@type": "AdministrativeArea",
      name: "Alberta, Canada",
    },
    sameAs: [],
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
    name: "Alberta Pulse Check",
    url: "https://albertapulsecheck.ca",
    description:
      "Real-time economic, real estate, and municipal data for Alberta.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate:
          "https://albertapulsecheck.ca/municipalities?q={search_term_string}",
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
    license: "https://albertapulsecheck.ca/terms",
    creator: {
      "@type": "Organization",
      name: "Alberta Pulse Check",
      url: "https://albertapulsecheck.ca",
    },
    spatialCoverage: {
      "@type": "Place",
      name: "Alberta, Canada",
    },
    isAccessibleForFree: false,
    distribution: {
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: "https://albertapulsecheck.ca/api",
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
    name: "Alberta Pulse Check",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://albertapulsecheck.ca",
    description:
      "Community intelligence dashboard for Alberta — real-time data on permits, assessments, energy, labour, migration, and more.",
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "CAD",
        name: "Explorer (Free)",
        description: "Macro economy pages and municipality explorer",
      },
      {
        "@type": "Offer",
        price: "29",
        priceCurrency: "CAD",
        name: "Pro",
        description:
          "Municipality deep-dives, API access, and full dashboard",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "29",
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
