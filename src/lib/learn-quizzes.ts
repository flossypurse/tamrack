// ============================================================
// Quiz questions for each Learn module
// ============================================================

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number; // 0-indexed
  explanation: string;
}

export const MODULE_QUIZZES: Record<string, QuizQuestion[]> = {
  "alberta-101": [
    {
      question: "How many natural regions does Alberta have?",
      options: ["4", "6", "8", "10"],
      correct: 1,
      explanation: "Alberta has six natural regions: Grassland, Parkland, Foothills, Rocky Mountain, Boreal Forest, and Canadian Shield.",
    },
    {
      question: "Which two cities make up the majority of Alberta's population?",
      options: ["Edmonton and Red Deer", "Calgary and Lethbridge", "Edmonton and Calgary", "Calgary and Medicine Hat"],
      correct: 2,
      explanation: "Edmonton (the capital) and Calgary together account for roughly two-thirds of Alberta's population.",
    },
    {
      question: "Approximately what is Alberta's current population?",
      options: ["2.5 million", "3.5 million", "4.8 million", "6.2 million"],
      correct: 2,
      explanation: "As of 2025, Alberta's population is approximately 4.8 million, making it Canada's fourth-most-populous province.",
    },
    {
      question: "Which natural region covers the largest area of Alberta?",
      options: ["Grassland", "Parkland", "Rocky Mountain", "Boreal Forest"],
      correct: 3,
      explanation: "The Boreal Forest covers the largest area of Alberta — roughly the entire northern half of the province.",
    },
    {
      question: "Alberta does NOT have which of the following taxes?",
      options: ["Property tax", "Provincial sales tax", "Corporate income tax", "Personal income tax"],
      correct: 1,
      explanation: "Alberta is the only province in Canada without a provincial sales tax (PST). This is a deliberate policy choice funded by energy royalties.",
    },
  ],

  "energy-engine": [
    {
      question: "What does the BCPI Energy Index measure?",
      options: [
        "Alberta's electricity consumption",
        "Canadian energy commodity export prices",
        "Oil company stock prices",
        "Gasoline prices at the pump",
      ],
      correct: 1,
      explanation: "The Bank of Canada's BCPI Energy Index tracks the prices of Canadian energy commodity exports — crude oil, natural gas, and refined products.",
    },
    {
      question: "When energy prices drop, how long before unemployment typically peaks?",
      options: ["Immediately", "1-2 months", "6-9 months", "2-3 years"],
      correct: 2,
      explanation: "Unemployment is a lagging indicator. The shockwave from an energy price drop takes 6-9 months to fully hit the labour market, moving through drilling companies, service contractors, and finally the retail/service sector.",
    },
    {
      question: "What happens to the Canadian dollar when oil prices rise?",
      options: [
        "It weakens because imports get expensive",
        "It strengthens because global demand for CAD increases",
        "It stays the same — currency and oil are unrelated",
        "It depends on US dollar policy only",
      ],
      correct: 1,
      explanation: "Canada is a net energy exporter. When oil prices rise, global demand for Canadian dollars increases (foreigners need CAD to buy Canadian oil), pushing the exchange rate up.",
    },
    {
      question: "Approximately how much does $1 of oil GDP multiply through Alberta's economy?",
      options: ["$1 (no multiplier)", "$1.50", "$2.50", "$5.00"],
      correct: 2,
      explanation: "For every $1 of oil GDP, roughly $2.50 circulates through the broader Alberta economy via construction, engineering, services, retail, and housing.",
    },
    {
      question: "Which sector has continued growing even during Alberta's energy busts?",
      options: ["Construction", "Mining", "Tech & information services", "Agriculture"],
      correct: 2,
      explanation: "Tech and information services GDP has grown steadily even during energy downturns like 2015-2016 — evidence of genuine economic diversification.",
    },
  ],

  "housing-machine": [
    {
      question: "How often does the Bank of Canada announce its policy rate?",
      options: ["Monthly", "8 times per year", "Quarterly", "Twice a year"],
      correct: 1,
      explanation: "The Bank of Canada makes 8 scheduled interest rate announcements per year (roughly every 6 weeks).",
    },
    {
      question: "Which mortgage rate responds most quickly to BoC rate changes?",
      options: ["5-year fixed", "10-year fixed", "Variable rate", "They all move at the same speed"],
      correct: 2,
      explanation: "Variable mortgage rates move almost in lockstep with the BoC policy rate within weeks. Fixed rates follow the bond market, which can actually move in the opposite direction.",
    },
    {
      question: "A 1% drop in mortgage rates gives buyers approximately how much more purchasing power?",
      options: ["2%", "5%", "10%", "20%"],
      correct: 2,
      explanation: "Roughly, every 1% drop in mortgage rates gives buyers about 10% more purchasing power. A move from 6% to 5% can shift someone from a condo budget to a townhouse budget.",
    },
    {
      question: "What vacancy rate is considered the 'balance point' between landlord and tenant power?",
      options: ["1%", "3%", "5%", "10%"],
      correct: 1,
      explanation: "A 3% vacancy rate is widely considered the balance point. Below 3%, landlords have pricing power. Above 5%, tenants have real negotiating leverage.",
    },
    {
      question: "From BoC rate decision to rent impact, the total lag is approximately:",
      options: ["1-3 months", "6-12 months", "2-4 years", "5+ years"],
      correct: 2,
      explanation: "The full chain — rate decision → mortgage rates → buyer demand → construction → completions → vacancy → rent — takes 2-4 years to fully play out.",
    },
  ],

  "tax-dollars": [
    {
      question: "What determines your property tax amount in Alberta?",
      options: [
        "Your home's purchase price",
        "Your assessed value multiplied by the mill rate",
        "A flat rate per household",
        "Your income level",
      ],
      correct: 1,
      explanation: "Property tax = assessed value × mill rate. The assessed value is what the municipality estimates your property is worth, and the mill rate is set by council each year.",
    },
    {
      question: "Which level of government receives the largest share of your property tax in most Alberta municipalities?",
      options: ["Federal government", "Provincial government", "Municipal government", "School boards"],
      correct: 2,
      explanation: "The municipal government typically receives the largest share of property tax revenue, though a significant portion also goes to education requisitions (school boards).",
    },
    {
      question: "What is equalization in the Canadian fiscal system?",
      options: [
        "Equal tax rates across all provinces",
        "Federal transfers to provinces with below-average fiscal capacity",
        "Provinces sharing revenue equally",
        "Municipal funding from the province",
      ],
      correct: 1,
      explanation: "Equalization is a federal transfer program that provides payments to provinces with below-average ability to generate tax revenue. Alberta has never received equalization payments.",
    },
    {
      question: "Why doesn't Alberta have a provincial sales tax?",
      options: [
        "It's unconstitutional",
        "Energy royalties historically replaced the need for one",
        "Alberta's economy is too small",
        "The federal government prohibited it",
      ],
      correct: 1,
      explanation: "Alberta's energy royalties have historically generated enough revenue to fund provincial services without a sales tax — a competitive advantage for attracting residents and businesses.",
    },
    {
      question: "What is a 'mill rate'?",
      options: [
        "The rate at which grain mills operate",
        "Tax per $1,000 of assessed property value",
        "The mortgage interest rate",
        "A federal transfer payment rate",
      ],
      correct: 1,
      explanation: "A mill rate is the tax rate per $1,000 of assessed property value. A mill rate of 10 means $10 in tax for every $1,000 of assessed value.",
    },
  ],

  "people-growth": [
    {
      question: "What is the dominant driver of Alberta's population volatility compared to other provinces?",
      options: [
        "Higher birth rates",
        "International immigration quotas",
        "Energy-cycle-driven interprovincial migration",
        "Lower death rates",
      ],
      correct: 2,
      explanation: "Alberta's population swings more than any other province because of interprovincial migration driven by the energy cycle. When oil booms, workers flood in; when it busts, many leave.",
    },
    {
      question: "When energy prices rise, what typically happens to Alberta's housing market 12-18 months later?",
      options: [
        "Prices fall because of oversupply",
        "No change — housing and energy are unrelated",
        "Prices rise due to population inflow",
        "Vacancy rates increase",
      ],
      correct: 2,
      explanation: "Rising energy prices attract workers from other provinces. This population inflow increases housing demand, pushing rents and house prices up 12-18 months after the energy price increase.",
    },
    {
      question: "Where do most of Alberta's interprovincial migrants come from?",
      options: [
        "Quebec and Manitoba",
        "Ontario, BC, and the Maritimes",
        "Saskatchewan only",
        "International sources",
      ],
      correct: 1,
      explanation: "The largest flows of interprovincial migration to Alberta come from Ontario, British Columbia, and the Maritime provinces — driven by relative economic opportunity.",
    },
    {
      question: "Alberta's labour participation rate is typically:",
      options: [
        "Below the national average",
        "About the same as the national average",
        "Above the national average",
        "Not measured",
      ],
      correct: 2,
      explanation: "Alberta consistently has one of the highest labour participation rates in Canada, reflecting its younger demographic and strong resource-sector job market.",
    },
    {
      question: "What is 'natural increase' in demographic terms?",
      options: [
        "GDP growth above inflation",
        "Births minus deaths",
        "Immigration minus emigration",
        "Population growth from all sources",
      ],
      correct: 1,
      explanation: "Natural increase is simply births minus deaths. It's one of three components of population change, along with international migration and interprovincial migration.",
    },
  ],

  "reading-signals": [
    {
      question: "Which of the following is a LEADING economic indicator?",
      options: ["Unemployment rate", "Corporate profits", "Building permits", "GDP growth"],
      correct: 2,
      explanation: "Building permits are a leading indicator — they signal construction activity (and jobs, spending, housing supply) 6-18 months in the future. Unemployment and GDP are lagging indicators.",
    },
    {
      question: "When the BCPI Energy Index starts declining, what should you expect next?",
      options: [
        "Immediate unemployment spike",
        "Housing prices drop within weeks",
        "Drilling activity and capital spending to decrease within 1-3 months",
        "Nothing — energy prices don't affect other indicators",
      ],
      correct: 2,
      explanation: "Drilling activity and capital spending respond first (1-3 months), followed by energy sector layoffs (2-3 months), service sector impacts (3-6 months), and full unemployment peak (6-9 months).",
    },
    {
      question: "What is the typical time lag from housing starts to completions?",
      options: ["1-3 months", "6 months", "12-24 months", "3-5 years"],
      correct: 2,
      explanation: "Housing starts take 12-24 months to become completions. This is why today's starts data tells you about tomorrow's supply — and today's supply was determined by decisions made 1-2 years ago.",
    },
    {
      question: "If building permits are rising but unemployment is also rising, what does this likely signal?",
      options: [
        "Data error",
        "The economy is recovering — permits lead, unemployment lags",
        "The economy is declining",
        "Nothing useful — they're unrelated",
      ],
      correct: 1,
      explanation: "Permits are a leading indicator and unemployment is lagging. Rising permits with rising unemployment often means the economy is turning a corner — the worst is behind but hasn't shown up in jobs data yet.",
    },
    {
      question: "Which metric is the best early warning for Alberta's economic direction?",
      options: ["Provincial GDP", "BCPI Energy Index", "Unemployment rate", "Consumer confidence"],
      correct: 1,
      explanation: "The BCPI Energy Index leads everything else in Alberta's economy by 3-6 months. When it moves, watch the downstream indicators — they will follow.",
    },
  ],

  "community-levers": [
    {
      question: "Which of these is within a municipality's direct control?",
      options: [
        "Interest rates",
        "Immigration policy",
        "Zoning bylaws",
        "Energy commodity prices",
      ],
      correct: 2,
      explanation: "Zoning bylaws are one of the most powerful levers municipalities control. They determine what can be built where — affecting housing supply, density, commercial activity, and neighbourhood character.",
    },
    {
      question: "Edmonton's recent city-wide upzoning allows:",
      options: [
        "Skyscrapers in all residential areas",
        "Mid-rise housing in areas previously zoned for single-family only",
        "Industrial use in residential zones",
        "No building permits required",
      ],
      correct: 1,
      explanation: "Edmonton's zoning reform allows mid-rise housing (typically 4-8 stories) in areas that were previously restricted to single-family homes — a structural change to increase housing supply.",
    },
    {
      question: "What is a Tax Increment Financing (TIF) district?",
      options: [
        "An area with no property taxes",
        "An area where tax revenue growth is reinvested locally",
        "A federal tax-free zone",
        "A district with higher tax rates",
      ],
      correct: 1,
      explanation: "In a TIF district, the increase in property tax revenue (above the baseline) is captured and reinvested in that specific area for infrastructure and development — a tool to catalyze growth.",
    },
    {
      question: "Why do municipalities offer tax incentives to attract businesses?",
      options: [
        "They are required to by law",
        "To increase short-term revenue",
        "To create jobs and broaden the tax base long-term",
        "Businesses cannot afford any taxes",
      ],
      correct: 2,
      explanation: "Municipal incentives aim to attract employers that create jobs, attract residents, and ultimately grow the tax base. The short-term tax reduction is an investment in long-term fiscal health.",
    },
    {
      question: "Which pattern is MOST within a community's ability to change?",
      options: [
        "Global oil prices",
        "Bank of Canada interest rates",
        "Local zoning and development approvals",
        "Federal immigration targets",
      ],
      correct: 2,
      explanation: "Local zoning and development approvals are directly controlled by municipal councils. Oil prices, interest rates, and immigration are federal/global forces outside local control.",
    },
  ],

  "safety-prosperity": [
    {
      question: "What typically happens to property crime rates during economic downturns?",
      options: [
        "They decrease because people stay home",
        "They increase as financial stress rises",
        "They stay exactly the same",
        "They only change with policing levels",
      ],
      correct: 1,
      explanation: "Property crime rates tend to increase during economic downturns as financial stress rises. The correlation isn't immediate — it lags the economic decline by several months.",
    },
    {
      question: "What is the relationship between health outcomes and economic conditions?",
      options: [
        "No relationship exists",
        "Better economy = worse health (stress from overwork)",
        "Economic prosperity generally correlates with better health outcomes",
        "Health is determined only by healthcare spending",
      ],
      correct: 2,
      explanation: "Economic prosperity correlates with better health outcomes through multiple channels: better nutrition, reduced stress, access to preventive care, cleaner environments, and safer working conditions.",
    },
    {
      question: "Why are wildfire statistics relevant to Alberta's economic outlook?",
      options: [
        "They aren't — wildfire is purely an environmental issue",
        "Wildfires affect energy infrastructure, forestry, tourism, and insurance costs",
        "Wildfires only matter for firefighting budgets",
        "Wildfires help the economy through reconstruction spending",
      ],
      correct: 1,
      explanation: "Wildfires affect energy infrastructure (pipelines, processing plants), forestry revenue, tourism, insurance premiums, and municipal budgets. The 2023 wildfire season cost Alberta billions.",
    },
    {
      question: "Emergency response times in a municipality tend to correlate with:",
      options: [
        "Weather conditions only",
        "Population density, road infrastructure, and budget allocation",
        "Time of day exclusively",
        "The number of hospitals",
      ],
      correct: 1,
      explanation: "Response times reflect population density, road infrastructure, station locations, and budget allocation for emergency services — all factors that municipalities can influence.",
    },
    {
      question: "Which is the best use of safety data for economic analysis?",
      options: [
        "Ignoring it — safety isn't an economic metric",
        "Using it as a lagging indicator of community economic health",
        "Only looking at policing budgets",
        "Comparing total crime counts between cities of different sizes",
      ],
      correct: 1,
      explanation: "Safety data serves as a lagging indicator of community economic health. Rising property crime, declining health outcomes, or increasing emergency calls can signal economic stress that hasn't yet shown up in GDP data.",
    },
  ],
};
