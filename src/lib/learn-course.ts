// ============================================================
// Learn Course Structure — module and lesson definitions
// ============================================================

export interface Lesson {
  slug: string;
  title: string;
  description: string;
}

export interface Module {
  id: number;
  slug: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
  color: string;
  lessons: Lesson[];
  /** Chart IDs from the chart registry to embed in this module */
  chartIds: string[];
}

export const PASSING_SCORE = 70;

export const COURSE_MODULES: Module[] = [
  {
    id: 1,
    slug: "alberta-101",
    title: "Alberta 101",
    description: "Geography, population, regions, and the basics you need before diving into the data.",
    icon: "MapPin",
    color: "#f59e0b",
    lessons: [
      { slug: "geography", title: "The Land", description: "Six natural regions, from prairies to Rockies." },
      { slug: "people", title: "The People", description: "4.8 million and growing — who lives here and where." },
      { slug: "regions", title: "The Regions", description: "Edmonton Metro, Calgary Metro, and everything in between." },
      { slug: "quiz", title: "Quiz", description: "Test your Alberta basics." },
    ],
    chartIds: ["macro-population"],
  },
  {
    id: 2,
    slug: "energy-engine",
    title: "The Energy Engine",
    description: "Oil, gas, pipelines, royalties — how energy prices ripple through every corner of the province.",
    icon: "Flame",
    color: "#f97316",
    lessons: [
      { slug: "commodities", title: "Energy Commodities", description: "BCPI Energy, WCS, and what drives prices." },
      { slug: "gdp-sectors", title: "GDP by Sector", description: "How deep does energy go in Alberta's economy?" },
      { slug: "jobs-shockwave", title: "The Jobs Shockwave", description: "From oil price drop to unemployment spike." },
      { slug: "migration", title: "The Migration Effect", description: "People follow the money — in and out." },
      { slug: "diversification", title: "The Diversification Question", description: "Is Alberta actually diversifying?" },
      { slug: "quiz", title: "Quiz", description: "Test your energy economics knowledge." },
    ],
    chartIds: ["macro-energy-price", "macro-oil-gas-gdp", "macro-energy-vs-unemployment"],
  },
  {
    id: 3,
    slug: "housing-machine",
    title: "The Housing Machine",
    description: "Real estate economics — from BoC rate decisions to your rent cheque, traced with live data.",
    icon: "Home",
    color: "#3b82f6",
    lessons: [
      { slug: "policy-rate", title: "The Price of Money", description: "How the BoC policy rate sets everything in motion." },
      { slug: "mortgage-rates", title: "Mortgage Rates Follow", description: "Fixed vs variable, and why they diverge." },
      { slug: "construction", title: "Building the Supply", description: "Starts, completions, and the 12-24 month pipeline." },
      { slug: "vacancy-rent", title: "Vacancy & Rent", description: "When supply meets demand — the 3% tipping point." },
      { slug: "quiz", title: "Quiz", description: "Test your housing economics knowledge." },
    ],
    chartIds: ["macro-policy-rate", "macro-energy-vs-housing"],
  },
  {
    id: 4,
    slug: "tax-dollars",
    title: "Your Tax Dollars",
    description: "Municipal, provincial, and federal fiscal flows — where your tax dollars actually go.",
    icon: "Landmark",
    color: "#10b981",
    lessons: [
      { slug: "property-tax", title: "Property Tax 101", description: "From assessment to mill rate to your tax bill." },
      { slug: "municipal-budgets", title: "Municipal Budgets", description: "Where cities spend and where they don't." },
      { slug: "provincial-federal", title: "Provincial & Federal", description: "Transfer payments, equalization, and fiscal federalism." },
      { slug: "quiz", title: "Quiz", description: "Test your fiscal knowledge." },
    ],
    chartIds: [],
  },
  {
    id: 5,
    slug: "people-growth",
    title: "People & Growth",
    description: "Immigration, labour markets, demographics — who is coming, where they go, what they need.",
    icon: "Users",
    color: "#ec4899",
    lessons: [
      { slug: "immigration", title: "Immigration Drivers", description: "International and interprovincial migration patterns." },
      { slug: "labour-market", title: "The Labour Market", description: "Employment, participation, and wage dynamics." },
      { slug: "demographics", title: "Demographics & Housing", description: "How population growth drives demand." },
      { slug: "quiz", title: "Quiz", description: "Test your demographics knowledge." },
    ],
    chartIds: ["macro-immigration", "macro-interprovincial", "macro-population"],
  },
  {
    id: 6,
    slug: "reading-signals",
    title: "Reading the Signals",
    description: "How to interpret economic indicators — leading vs lagging, and what to watch.",
    icon: "TrendingUp",
    color: "#8b5cf6",
    lessons: [
      { slug: "leading-lagging", title: "Leading vs Lagging", description: "The difference between prediction and confirmation." },
      { slug: "chain-reactions", title: "Chain Reactions", description: "How indicators connect with time lags." },
      { slug: "dashboard-reading", title: "Reading the Dashboard", description: "Putting it all together — the signals that matter." },
      { slug: "quiz", title: "Quiz", description: "Test your indicator literacy." },
    ],
    chartIds: ["macro-unemployment", "macro-building-permits", "macro-business-licences"],
  },
  {
    id: 7,
    slug: "community-levers",
    title: "Community Levers",
    description: "What municipalities can actually control — policy levers, market levers, and community action.",
    icon: "Wrench",
    color: "#6366f1",
    lessons: [
      { slug: "municipal-powers", title: "Municipal Powers", description: "What local government can and cannot do." },
      { slug: "zoning-development", title: "Zoning & Development", description: "How land-use rules shape communities." },
      { slug: "economic-development", title: "Economic Development", description: "Attracting investment and jobs." },
      { slug: "quiz", title: "Quiz", description: "Test your community governance knowledge." },
    ],
    chartIds: [],
  },
  {
    id: 8,
    slug: "safety-prosperity",
    title: "Safety & Prosperity",
    description: "Crime, health, environment as economic factors — safety data as an early warning system.",
    icon: "Shield",
    color: "#ef4444",
    lessons: [
      { slug: "crime-economics", title: "Crime & Economics", description: "How economic conditions drive safety outcomes." },
      { slug: "health-outcomes", title: "Health & Prosperity", description: "The link between health data and economic health." },
      { slug: "environment-economy", title: "Environment & Economy", description: "Emissions, wildfire, and economic risk." },
      { slug: "quiz", title: "Quiz", description: "Test your safety & prosperity knowledge." },
    ],
    chartIds: [],
  },
];

export function getModule(slug: string): Module | undefined {
  return COURSE_MODULES.find((m) => m.slug === slug);
}

export function getLesson(moduleSlug: string, lessonSlug: string): { module: Module; lesson: Lesson; lessonIndex: number } | undefined {
  const mod = getModule(moduleSlug);
  if (!mod) return undefined;
  const lessonIndex = mod.lessons.findIndex((l) => l.slug === lessonSlug);
  if (lessonIndex === -1) return undefined;
  return { module: mod, lesson: mod.lessons[lessonIndex], lessonIndex };
}

export function getNextLesson(moduleSlug: string, lessonSlug: string): { moduleSlug: string; lessonSlug: string } | null {
  const current = getLesson(moduleSlug, lessonSlug);
  if (!current) return null;

  // Next lesson in same module
  if (current.lessonIndex < current.module.lessons.length - 1) {
    return { moduleSlug, lessonSlug: current.module.lessons[current.lessonIndex + 1].slug };
  }

  // First lesson of next module
  const nextModuleIndex = COURSE_MODULES.findIndex((m) => m.slug === moduleSlug) + 1;
  if (nextModuleIndex < COURSE_MODULES.length) {
    return { moduleSlug: COURSE_MODULES[nextModuleIndex].slug, lessonSlug: COURSE_MODULES[nextModuleIndex].lessons[0].slug };
  }

  return null;
}

export function getPrevLesson(moduleSlug: string, lessonSlug: string): { moduleSlug: string; lessonSlug: string } | null {
  const current = getLesson(moduleSlug, lessonSlug);
  if (!current) return null;

  // Previous lesson in same module
  if (current.lessonIndex > 0) {
    return { moduleSlug, lessonSlug: current.module.lessons[current.lessonIndex - 1].slug };
  }

  // Last lesson of previous module
  const prevModuleIndex = COURSE_MODULES.findIndex((m) => m.slug === moduleSlug) - 1;
  if (prevModuleIndex >= 0) {
    const prevMod = COURSE_MODULES[prevModuleIndex];
    return { moduleSlug: prevMod.slug, lessonSlug: prevMod.lessons[prevMod.lessons.length - 1].slug };
  }

  return null;
}
