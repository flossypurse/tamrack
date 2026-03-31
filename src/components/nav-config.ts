import {
  Activity,
  LayoutDashboard,
  Radar,
  Flame,
  RefreshCw,
  PieChart,
  Users,
  Wheat,
  Cannabis,
  Home,
  Target,
  MapPin,
  GraduationCap,
  Database,
  Building2,
  Globe,
  BookOpen,
  Building,
  Store,
  Scale,
  ShieldAlert,
  Rocket,
  CloudSun,
  Wind,
  Waves,
  Car,
  Siren,
  TreePine,
  Landmark,
  Pickaxe,
  TrendingUp,
  GitCompare,
  Wrench,
  Briefcase,
  ShoppingCart,
  Factory,
  HardHat,
  HeartPulse,
  Shield,
  Plane,
  CreditCard,
  Calculator,
} from "lucide-react";
import type { ElementType } from "react";
import {
  getLiveMunicipalities,
  getMunicipalitiesByRegion,
  REGION_LABELS,
  REGION_ORDER,
} from "@/lib/municipality-registry";

// ============================================================
// Types
// ============================================================

export type NavItem = {
  href: string;
  label: string;
  icon: ElementType;
};

export type NavSubSection = {
  label?: string; // optional sub-header (e.g., "Analysis", "Safety")
  items: NavItem[];
};

export type TopLevelSection = {
  key: string;
  label: string;
  icon: ElementType;
  href: string; // default route for this section (overview page)
  /** Used to match the current pathname to highlight this section */
  matchPrefixes: string[];
  /** Sub-sections shown in the contextual sidebar */
  subSections: NavSubSection[];
};

// ============================================================
// Section definitions
// ============================================================

export const sections: TopLevelSection[] = [
  {
    key: "home",
    label: "Home",
    icon: LayoutDashboard,
    href: "/home",
    matchPrefixes: ["/home"],
    subSections: [
      {
        items: [
          { href: "/home", label: "Hub", icon: LayoutDashboard },
          { href: "/home/dashboard", label: "Dashboard", icon: Activity },
          { href: "/home/signals", label: "Signals", icon: Radar },
          { href: "/home/briefings", label: "Briefings", icon: Briefcase },
        ],
      },
      {
        label: "Learn",
        items: [
          { href: "/home/learn", label: "Overview", icon: GraduationCap },
          { href: "/home/learn/housing-machine", label: "The Housing Machine", icon: Home },
          { href: "/home/learn/energy-economy", label: "Energy Engine", icon: Flame },
          { href: "/home/learn/reading-the-signals", label: "Reading Signals", icon: TrendingUp },
          { href: "/home/learn/your-tax-dollars", label: "Your Tax Dollars", icon: Landmark },
          { href: "/home/learn/people-and-growth", label: "People & Growth", icon: Users },
          { href: "/home/learn/safety-and-prosperity", label: "Safety & Prosperity", icon: Shield },
          { href: "/home/learn/community-levers", label: "Community Levers", icon: Wrench },
        ],
      },
    ],
  },
  {
    key: "economy",
    label: "Economy",
    icon: PieChart,
    href: "/economy",
    matchPrefixes: ["/economy"],
    subSections: [
      {
        label: "Industries",
        items: [
          { href: "/economy", label: "Overview", icon: PieChart },
          { href: "/economy/energy", label: "Energy", icon: Flame },
          { href: "/economy/drilling", label: "Drilling", icon: Pickaxe },
          { href: "/economy/boom-bust", label: "Boom-Bust Cycle", icon: RefreshCw },
          { href: "/economy/diversification", label: "Diversification", icon: PieChart },
          { href: "/economy/agriculture", label: "Agriculture", icon: Wheat },
          { href: "/economy/cannabis", label: "Cannabis", icon: Cannabis },
          { href: "/economy/retail", label: "Retail Trade", icon: ShoppingCart },
          { href: "/economy/businesses", label: "Business Dynamics", icon: Building2 },
          { href: "/economy/employers", label: "Employers", icon: HardHat },
        ],
      },
      {
        label: "Analysis",
        items: [
          { href: "/economy/benchmarks", label: "Benchmarks", icon: Scale },
          { href: "/economy/corridors", label: "Growth Corridors", icon: Rocket },
          { href: "/economy/risk", label: "Market Risk", icon: ShieldAlert },
          { href: "/economy/cycle-position", label: "Cycle Position", icon: RefreshCw },
          { href: "/economy/invest", label: "Investment Thesis", icon: TrendingUp },
          { href: "/economy/compare", label: "Compare", icon: GitCompare },
        ],
      },
    ],
  },
  {
    key: "real-estate",
    label: "Real Estate",
    icon: Home,
    href: "/real-estate",
    matchPrefixes: ["/real-estate"],
    subSections: [
      {
        items: [
          { href: "/real-estate", label: "Overview", icon: Home },
          { href: "/real-estate/market", label: "Market Intel", icon: Home },
          { href: "/real-estate/prospects", label: "Prospect Leads", icon: Target },
          { href: "/real-estate/neighbourhoods", label: "Neighbourhoods", icon: MapPin },
          { href: "/real-estate/pipeline", label: "Dev Pipeline", icon: Building },
          { href: "/real-estate/rental", label: "Rental Intel", icon: Home },
          { href: "/real-estate/assessments", label: "Assessments", icon: Building2 },
          { href: "/real-estate/commercial", label: "Commercial", icon: Store },
        ],
      },
    ],
  },
  {
    key: "community",
    label: "Community",
    icon: Users,
    href: "/community",
    matchPrefixes: ["/community"],
    subSections: [
      {
        label: "People",
        items: [
          { href: "/community", label: "Overview", icon: Users },
          { href: "/community/demographics", label: "Demographics", icon: Users },
          { href: "/community/immigration", label: "Immigration", icon: Plane },
          { href: "/community/labour", label: "Labour", icon: HardHat },
          { href: "/community/health", label: "Health", icon: HeartPulse },
          { href: "/community/mortality", label: "Mortality", icon: HeartPulse },
        ],
      },
      {
        label: "Safety",
        items: [
          { href: "/community/crime", label: "Crime", icon: Shield },
          { href: "/community/fire-response", label: "Fire Response", icon: Flame },
          { href: "/community/traffic", label: "Traffic & Roads", icon: Car },
          { href: "/community/seismic", label: "Seismic", icon: Activity },
          { href: "/community/emergencies", label: "Emergencies", icon: Siren },
        ],
      },
    ],
  },
  {
    key: "environment",
    label: "Environment",
    icon: CloudSun,
    href: "/environment",
    matchPrefixes: ["/environment"],
    subSections: [
      {
        items: [
          { href: "/environment", label: "Overview", icon: CloudSun },
          { href: "/environment/weather", label: "Weather", icon: CloudSun },
          { href: "/environment/air-quality", label: "Air Quality", icon: Wind },
          { href: "/environment/water", label: "Water & Rivers", icon: Waves },
          { href: "/environment/wildfire", label: "Wildfire", icon: TreePine },
          { href: "/environment/emissions", label: "Emissions", icon: Factory },
        ],
      },
    ],
  },
  {
    key: "governance",
    label: "Governance",
    icon: Landmark,
    href: "/governance",
    matchPrefixes: ["/governance"],
    subSections: [
      {
        items: [
          { href: "/governance", label: "Overview", icon: Landmark },
          { href: "/governance/legislature", label: "Legislature", icon: Building2 },
          { href: "/governance/federal", label: "Federal", icon: Building },
          { href: "/governance/elections", label: "Elections", icon: Shield },
          { href: "/governance/campaign-finance", label: "Campaign Finance", icon: CreditCard },
          { href: "/governance/spending", label: "Gov Spending", icon: Scale },
          { href: "/governance/transfers", label: "Transfers", icon: GitCompare },
          { href: "/governance/legislation", label: "Legislation", icon: BookOpen },
        ],
      },
    ],
  },
  {
    key: "municipalities",
    label: "Municipalities",
    icon: Globe,
    href: "/municipalities",
    matchPrefixes: ["/municipalities", "/m/"],
    subSections: [], // built dynamically
  },
];

// ============================================================
// Dynamic municipality sub-sections
// ============================================================

export function buildMunicipalitySubSections(): NavSubSection[] {
  const byRegion = getMunicipalitiesByRegion();
  const live = getLiveMunicipalities();

  const result: NavSubSection[] = [
    {
      items: [
        { href: "/municipalities", label: `All (${live.length} live)`, icon: Globe },
        { href: "/municipalities/coverage", label: "Data Coverage", icon: Database },
      ],
    },
  ];

  for (const region of REGION_ORDER) {
    const municipalities = (byRegion[region] || []).filter(
      (m) => m.status === "live"
    );
    if (municipalities.length === 0) continue;

    result.push({
      label: REGION_LABELS[region],
      items: municipalities
        .sort((a, b) => (b.population || 0) - (a.population || 0))
        .map((m) => ({
          href: `/municipalities/${m.slug}`,
          label: m.name,
          icon: Building2,
        })),
    });
  }

  return result;
}

// ============================================================
// Flatten all items for command palette
// ============================================================

export function getAllNavItems(): NavItem[] {
  const seen = new Set<string>();
  const items: NavItem[] = [];

  const muniSection = {
    ...sections.find((s) => s.key === "municipalities")!,
    subSections: buildMunicipalitySubSections(),
  };

  const allSections = [
    ...sections.filter((s) => s.key !== "municipalities"),
    muniSection,
  ];

  for (const section of allSections) {
    for (const sub of section.subSections) {
      for (const item of sub.items) {
        if (seen.has(item.href)) continue;
        seen.add(item.href);
        items.push(item);
      }
    }
  }

  return items;
}

// ============================================================
// Tools section (shown in avatar menu / sidebar footer)
// ============================================================

export const toolsItems: NavItem[] = [
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/tools/home-costs", label: "Home Buying Costs", icon: Home },
  { href: "/tools/pay-calculator", label: "Take-Home Pay", icon: Calculator },
  { href: "/tools/deposit-calculator", label: "Deposit Interest", icon: Scale },
  { href: "/tools/docs", label: "API Docs", icon: BookOpen },
  { href: "/tools/sources", label: "Data Sources", icon: Database },
];
