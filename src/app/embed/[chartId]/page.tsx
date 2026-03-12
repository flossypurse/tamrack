import { notFound } from "next/navigation";
import {
  NeighbourhoodBarChart,
  TimeSeriesAreaChart,
  TimeSeriesBarChart,
  MultiSeriesLineChart,
  type MultiSeriesPoint,
} from "@/components/chart";
import { getMunicipality, getLiveMunicipalities } from "@/lib/municipality-registry";
import {
  fetchAssessmentsByGroup,
  fetchBusinessCategories,
  fetchVacantLots,
  fetchPermitsByGroup,
} from "@/lib/municipality-data";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  fetchAlbertaActivityIndex,
  fetchEdmontonBusinessLicences,
  fetchEdmontonPermitsSummary,
  BOC_SERIES,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";

export const dynamic = "force-dynamic";

// ============================================================
// Chart registry — maps chartId to data fetcher + renderer
// ============================================================

interface ChartDef {
  title: string;
  source: string;
  render: () => Promise<React.ReactNode>;
}

function municipalityChart(slug: string, type: string): ChartDef | null {
  const config = getMunicipality(slug);
  if (!config) return null;

  switch (type) {
    case "assessment-by-zone":
      return {
        title: `${config.name} — Avg Assessment by Zone`,
        source: config.dataSource,
        render: async () => {
          const data = await fetchAssessmentsByGroup(config, "zoning");
          const chartData = data.slice(0, 15).map((d) => ({
            neighbourhood: d.group,
            avgValue: d.avgAssessment,
          }));
          return (
            <NeighbourhoodBarChart
              data={chartData}
              dataKey="avgValue"
              color={config.color}
              valuePrefix="$"
              tooltipLabel="Avg Assessment"
              height={350}
            />
          );
        },
      };

    case "properties-by-zone":
      return {
        title: `${config.name} — Properties by Zone`,
        source: config.dataSource,
        render: async () => {
          const data = await fetchAssessmentsByGroup(config, "zoning");
          const chartData = data.slice(0, 15).map((d) => ({
            neighbourhood: d.group,
            permits: d.count,
          }));
          return (
            <NeighbourhoodBarChart
              data={chartData}
              dataKey="permits"
              color="#3b82f6"
              tooltipLabel="Properties"
              height={350}
            />
          );
        },
      };

    case "assessment-by-neighbourhood":
    case "assessment-by-subdivision":
      return {
        title: `${config.name} — Avg Assessment by Area`,
        source: config.dataSource,
        render: async () => {
          const groupBy = config.fields.neighbourhood ? "neighbourhood" : "subdivision";
          const data = await fetchAssessmentsByGroup(config, groupBy);
          const chartData = data
            .sort((a, b) => b.avgAssessment - a.avgAssessment)
            .slice(0, 15)
            .map((d) => ({
              neighbourhood: d.group,
              avgValue: d.avgAssessment,
            }));
          return (
            <NeighbourhoodBarChart
              data={chartData}
              dataKey="avgValue"
              color="#10b981"
              valuePrefix="$"
              tooltipLabel="Avg Assessment"
              height={350}
            />
          );
        },
      };

    case "businesses":
      return {
        title: `${config.name} — Businesses by Category`,
        source: config.dataSource,
        render: async () => {
          const data = await fetchBusinessCategories(config);
          const chartData = data.slice(0, 15).map((d) => ({
            neighbourhood: d.category,
            permits: d.count,
          }));
          return (
            <NeighbourhoodBarChart
              data={chartData}
              dataKey="permits"
              color="#a855f7"
              tooltipLabel="Businesses"
              height={350}
            />
          );
        },
      };

    case "vacant":
      return {
        title: `${config.name} — Vacant Lots`,
        source: config.dataSource,
        render: async () => {
          const data = await fetchVacantLots(config);
          const chartData = data.map((d) => ({
            neighbourhood: d.group,
            permits: d.count,
          }));
          return (
            <NeighbourhoodBarChart
              data={chartData}
              dataKey="permits"
              color="#f59e0b"
              tooltipLabel="Vacant Lots"
              height={350}
            />
          );
        },
      };

    case "permits":
      return {
        title: `${config.name} — Permits`,
        source: config.dataSource,
        render: async () => {
          const data = await fetchPermitsByGroup(config);
          const chartData = data.slice(0, 15).map((d) => ({
            neighbourhood: d.group,
            permits: d.count,
          }));
          return (
            <NeighbourhoodBarChart
              data={chartData}
              dataKey="permits"
              color="#3b82f6"
              tooltipLabel="Permits"
              height={350}
            />
          );
        },
      };

    default:
      return null;
  }
}

// Helper to merge two time series by month for dual-axis charts
function mergeTwoSeries(
  seriesA: TimeSeriesPoint[],
  seriesB: TimeSeriesPoint[],
  keyA: string,
  keyB: string
): MultiSeriesPoint[] {
  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of seriesA) {
    const month = p.date.slice(0, 7);
    if (!dateMap.has(month)) dateMap.set(month, { date: p.date, [keyA]: 0, [keyB]: 0 });
    dateMap.get(month)![keyA] = p.value;
  }
  for (const p of seriesB) {
    const month = p.date.slice(0, 7);
    if (!dateMap.has(month)) dateMap.set(month, { date: p.date, [keyA]: 0, [keyB]: 0 });
    dateMap.get(month)![keyB] = p.value;
  }
  return Array.from(dateMap.values())
    .filter((p) => p[keyA] && p[keyB])
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

// Macro charts (province-wide)
function macroChart(type: string): ChartDef | null {
  switch (type) {
    // === Existing ===
    case "policy-rate":
      return {
        title: "BoC Policy Rate",
        source: "Bank of Canada Valet API",
        render: async () => {
          const data = await fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE);
          return <TimeSeriesAreaChart data={data} color="#3b82f6" height={350} valueSuffix="%" />;
        },
      };

    case "cad-usd":
      return {
        title: "CAD/USD Exchange Rate",
        source: "Bank of Canada Valet API",
        render: async () => {
          const data = await fetchBoCTimeSeries(BOC_SERIES.CAD_USD, 240);
          return <TimeSeriesAreaChart data={data} color="#10b981" height={350} valuePrefix="$" />;
        },
      };

    case "unemployment":
      return {
        title: "Alberta Unemployment Rate",
        source: "Statistics Canada 14-10-0287",
        render: async () => {
          const s = STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 60);
          return <TimeSeriesAreaChart data={data} color="#ef4444" height={350} valueSuffix="%" />;
        },
      };

    case "cpi":
      return {
        title: "Alberta CPI (All Items)",
        source: "Statistics Canada 18-10-0004",
        render: async () => {
          const s = STATSCAN_SERIES.AB_CPI;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 60);
          return <TimeSeriesAreaChart data={data} color="#a855f7" height={350} />;
        },
      };

    case "population":
      return {
        title: "Alberta Population",
        source: "Statistics Canada 17-10-0005",
        render: async () => {
          const s = STATSCAN_SERIES.AB_POPULATION;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate, 40);
          return <TimeSeriesAreaChart data={data} color="#3b82f6" height={350} compact />;
        },
      };

    // === Energy page ===
    case "energy-price":
      return {
        title: "BoC Energy Commodity Price Index",
        source: "Bank of Canada Valet API",
        render: async () => {
          const data = await fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 240);
          return <TimeSeriesAreaChart data={data} color="#f97316" height={350} />;
        },
      };

    case "all-commodities":
      return {
        title: "BoC All Commodities Index",
        source: "Bank of Canada Valet API",
        render: async () => {
          const data = await fetchBoCTimeSeries(BOC_SERIES.BCPI_ALL, 240);
          return <TimeSeriesAreaChart data={data} color="#3b82f6" height={350} />;
        },
      };

    case "non-energy":
      return {
        title: "Non-Energy Commodity Index",
        source: "Bank of Canada Valet API",
        render: async () => {
          const data = await fetchBoCTimeSeries(BOC_SERIES.BCPI_NON_ENERGY, 120);
          return <TimeSeriesAreaChart data={data} color="#10b981" height={350} />;
        },
      };

    case "energy-vs-cad":
      return {
        title: "Energy Price vs CAD/USD",
        source: "Bank of Canada Valet API",
        render: async () => {
          const [energy, cad] = await Promise.all([
            fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120),
            fetchBoCTimeSeries(BOC_SERIES.CAD_USD, 120),
          ]);
          const merged = mergeTwoSeries(energy, cad, "energy", "cad");
          return (
            <MultiSeriesLineChart
              data={merged}
              series={[
                { key: "energy", label: "Energy Index", color: "#f97316", yAxisId: "left" },
                { key: "cad", label: "CAD/USD", color: "#10b981", prefix: "$", yAxisId: "right" },
              ]}
              height={350}
              dualAxis
            />
          );
        },
      };

    case "oil-gas-gdp":
      return {
        title: "Alberta Mining/Oil & Gas GDP",
        source: "Statistics Canada 36-10-0402",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
          return <TimeSeriesAreaChart data={data} color="#f59e0b" height={350} compact />;
        },
      };

    case "construction-gdp":
      return {
        title: "Alberta Construction GDP",
        source: "Statistics Canada 36-10-0402",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP_CONSTRUCTION;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
          return <TimeSeriesAreaChart data={data} color="#06b6d4" height={350} compact />;
        },
      };

    // === Labour page ===
    case "employment":
      return {
        title: "Alberta Employment",
        source: "Statistics Canada 14-10-0287",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_EMPLOYMENT;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 60);
          return <TimeSeriesAreaChart data={data} color="#3b82f6" height={350} compact />;
        },
      };

    case "participation":
      return {
        title: "Participation Rate",
        source: "Statistics Canada 14-10-0287",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_PARTICIPATION_RATE;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 60);
          return <TimeSeriesAreaChart data={data} color="#10b981" height={350} valueSuffix="%" />;
        },
      };

    case "employment-rate":
      return {
        title: "Employment Rate",
        source: "Statistics Canada 14-10-0287",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_EMPLOYMENT_RATE;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 60);
          return <TimeSeriesAreaChart data={data} color="#8b5cf6" height={350} valueSuffix="%" />;
        },
      };

    case "weekly-earnings":
      return {
        title: "Average Weekly Earnings",
        source: "Statistics Canada 14-10-0223",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_WEEKLY_EARNINGS;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 60);
          return <TimeSeriesAreaChart data={data} color="#f59e0b" height={350} valuePrefix="$" />;
        },
      };

    case "employment-vs-unemployment":
      return {
        title: "Employment vs Unemployment Rate",
        source: "Statistics Canada 14-10-0287",
        render: async () => {
          const [employment, unemployment] = await Promise.all([
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_EMPLOYMENT.tableId, STATSCAN_SERIES.AB_EMPLOYMENT.coordinate, 60),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId, STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate, 60),
          ]);
          const merged = mergeTwoSeries(employment, unemployment, "employment", "unemployment");
          return (
            <MultiSeriesLineChart
              data={merged}
              series={[
                { key: "employment", label: "Employment (K)", color: "#3b82f6", yAxisId: "left" },
                { key: "unemployment", label: "Unemployment %", color: "#ef4444", suffix: "%", yAxisId: "right" },
              ]}
              height={350}
              dualAxis
            />
          );
        },
      };

    // === Migration page ===
    case "immigration":
      return {
        title: "International Immigration to Alberta",
        source: "Statistics Canada 17-10-0008",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_IMMIGRATION;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
          return <TimeSeriesBarChart data={data} color="#10b981" height={350} />;
        },
      };

    case "interprovincial":
      return {
        title: "Net Interprovincial Migration",
        source: "Statistics Canada 17-10-0008",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_NET_INTERPROVINCIAL;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
          return <TimeSeriesBarChart data={data} color="#f97316" height={350} />;
        },
      };

    case "migration-components": {
      return {
        title: "Population Growth Components",
        source: "Statistics Canada 17-10-0008",
        render: async () => {
          const [immigration, netInterprov, emigration, births, deaths] = await Promise.all([
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_IMMIGRATION.tableId, STATSCAN_SERIES.AB_IMMIGRATION.coordinate, 20),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.tableId, STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.coordinate, 20),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_EMIGRATION.tableId, STATSCAN_SERIES.AB_EMIGRATION.coordinate, 20),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_BIRTHS.tableId, STATSCAN_SERIES.AB_BIRTHS.coordinate, 20),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_DEATHS.tableId, STATSCAN_SERIES.AB_DEATHS.coordinate, 20),
          ]);
          const dateMap = new Map<string, MultiSeriesPoint>();
          const addSeries = (data: TimeSeriesPoint[], key: string) => {
            for (const p of data) {
              if (!dateMap.has(p.date)) dateMap.set(p.date, { date: p.date });
              dateMap.get(p.date)![key] = p.value;
            }
          };
          addSeries(immigration, "immigration");
          addSeries(netInterprov, "netInterprov");
          addSeries(emigration, "emigration");
          addSeries(births, "births");
          addSeries(deaths, "deaths");
          const merged = Array.from(dateMap.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
          return (
            <MultiSeriesLineChart
              data={merged}
              series={[
                { key: "immigration", label: "International Immigration", color: "#10b981" },
                { key: "netInterprov", label: "Net Interprovincial", color: "#3b82f6" },
                { key: "emigration", label: "Net Emigration", color: "#ef4444" },
                { key: "births", label: "Births", color: "#f59e0b" },
                { key: "deaths", label: "Deaths", color: "#6b7280" },
              ]}
              height={350}
            />
          );
        },
      };
    }

    case "migration-vs-energy":
      return {
        title: "Net Migration vs Energy Prices",
        source: "Statistics Canada / Bank of Canada",
        render: async () => {
          const [interprovincial, energy] = await Promise.all([
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.tableId, STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.coordinate, 40),
            fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120),
          ]);
          const dateMap = new Map<string, MultiSeriesPoint>();
          for (const p of interprovincial) {
            dateMap.set(p.date, { date: p.date, migration: p.value, energy: 0 });
          }
          for (const p of energy) {
            const quarter = p.date.slice(0, 7);
            for (const [key, point] of dateMap) {
              if (key.startsWith(quarter.slice(0, 4))) {
                if (!point.energy || (point.energy as number) === 0) {
                  point.energy = p.value;
                }
              }
            }
          }
          const merged = Array.from(dateMap.values())
            .filter((p) => p.energy)
            .sort((a, b) => String(a.date).localeCompare(String(b.date)));
          return (
            <MultiSeriesLineChart
              data={merged}
              series={[
                { key: "migration", label: "Net Interprovincial", color: "#3b82f6", yAxisId: "left" },
                { key: "energy", label: "Energy Index", color: "#f97316", yAxisId: "right" },
              ]}
              height={350}
              dualAxis
            />
          );
        },
      };

    // === Agriculture page ===
    case "ag-commodity":
      return {
        title: "BoC Agriculture Commodity Price Index",
        source: "Bank of Canada Valet API",
        render: async () => {
          const data = await fetchBoCTimeSeries(BOC_SERIES.BCPI_AGRICULTURE, 240);
          return <TimeSeriesAreaChart data={data} color="#f59e0b" height={350} />;
        },
      };

    case "ag-gdp":
      return {
        title: "Agriculture GDP — Alberta",
        source: "Statistics Canada 36-10-0402",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP_AGRICULTURE;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
          return <TimeSeriesAreaChart data={data} color="#10b981" height={350} compact />;
        },
      };

    case "farm-receipts":
      return {
        title: "Farm Cash Receipts — Alberta",
        source: "Statistics Canada 32-10-0045",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_FARM_CASH_RECEIPTS;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
          return <TimeSeriesBarChart data={data} color="#f59e0b" height={350} compact />;
        },
      };

    case "crop-vs-livestock":
      return {
        title: "Crop vs Livestock Receipts",
        source: "Statistics Canada 32-10-0045",
        render: async () => {
          const [crop, livestock] = await Promise.all([
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_FARM_CROP_RECEIPTS.tableId, STATSCAN_SERIES.AB_FARM_CROP_RECEIPTS.coordinate, 40),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_FARM_LIVESTOCK_RECEIPTS.tableId, STATSCAN_SERIES.AB_FARM_LIVESTOCK_RECEIPTS.coordinate, 40),
          ]);
          const merged = mergeTwoSeries(crop, livestock, "crop", "livestock");
          return (
            <MultiSeriesLineChart
              data={merged}
              series={[
                { key: "crop", label: "Crop Receipts", color: "#f59e0b" },
                { key: "livestock", label: "Livestock Receipts", color: "#ef4444" },
              ]}
              height={350}
            />
          );
        },
      };

    case "ag-vs-energy":
      return {
        title: "Agriculture vs Energy Commodity Prices",
        source: "Bank of Canada Valet API",
        render: async () => {
          const [agIndex, energyIndex] = await Promise.all([
            fetchBoCTimeSeries(BOC_SERIES.BCPI_AGRICULTURE, 120),
            fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120),
          ]);
          const merged = mergeTwoSeries(agIndex, energyIndex, "agriculture", "energy");
          return (
            <MultiSeriesLineChart
              data={merged}
              series={[
                { key: "agriculture", label: "Agriculture", color: "#f59e0b", yAxisId: "left" },
                { key: "energy", label: "Energy", color: "#f97316", yAxisId: "right" },
              ]}
              height={350}
              dualAxis
            />
          );
        },
      };

    // === Diversification page ===
    case "gdp-by-industry": {
      return {
        title: "GDP by Industry — Alberta",
        source: "Statistics Canada 36-10-0402",
        render: async () => {
          const [oilGas, construction, agriculture, manufacturing, tech, realEstate] = await Promise.all([
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.tableId, STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.coordinate, 40),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP_CONSTRUCTION.tableId, STATSCAN_SERIES.AB_GDP_CONSTRUCTION.coordinate, 40),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP_AGRICULTURE.tableId, STATSCAN_SERIES.AB_GDP_AGRICULTURE.coordinate, 40),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP_MANUFACTURING.tableId, STATSCAN_SERIES.AB_GDP_MANUFACTURING.coordinate, 40),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP_TECH.tableId, STATSCAN_SERIES.AB_GDP_TECH.coordinate, 40),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP_REAL_ESTATE.tableId, STATSCAN_SERIES.AB_GDP_REAL_ESTATE.coordinate, 40),
          ]);
          const dateMap = new Map<string, MultiSeriesPoint>();
          const addSeries = (data: TimeSeriesPoint[], key: string) => {
            for (const p of data) {
              if (!dateMap.has(p.date)) dateMap.set(p.date, { date: p.date });
              dateMap.get(p.date)![key] = p.value;
            }
          };
          addSeries(oilGas, "oilGas");
          addSeries(construction, "construction");
          addSeries(agriculture, "agriculture");
          addSeries(manufacturing, "manufacturing");
          addSeries(tech, "tech");
          addSeries(realEstate, "realEstate");
          const merged = Array.from(dateMap.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
          return (
            <MultiSeriesLineChart
              data={merged}
              series={[
                { key: "oilGas", label: "Mining/Oil/Gas", color: "#f97316" },
                { key: "construction", label: "Construction", color: "#3b82f6" },
                { key: "manufacturing", label: "Manufacturing", color: "#8b5cf6" },
                { key: "tech", label: "Tech/Professional", color: "#10b981" },
                { key: "realEstate", label: "Real Estate", color: "#ec4899" },
                { key: "agriculture", label: "Agriculture", color: "#f59e0b" },
              ]}
              height={350}
            />
          );
        },
      };
    }

    case "oil-gas-share":
      return {
        title: "Oil & Gas Share of GDP",
        source: "Statistics Canada 36-10-0402",
        render: async () => {
          const [totalGdp, oilGasGdp] = await Promise.all([
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP.tableId, STATSCAN_SERIES.AB_GDP.coordinate, 40),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.tableId, STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.coordinate, 40),
          ]);
          const dateValues = new Map<string, number>();
          for (const p of totalGdp) dateValues.set(p.date, p.value);
          const shareData: TimeSeriesPoint[] = [];
          for (const p of oilGasGdp) {
            const total = dateValues.get(p.date);
            if (total && total > 0) {
              shareData.push({ date: p.date, value: parseFloat(((p.value / total) * 100).toFixed(1)) });
            }
          }
          return <TimeSeriesAreaChart data={shareData} color="#f97316" height={350} valueSuffix="%" />;
        },
      };

    case "tech-gdp":
      return {
        title: "Tech & Professional Services GDP",
        source: "Statistics Canada 36-10-0402",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP_TECH;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
          return <TimeSeriesAreaChart data={data} color="#10b981" height={350} compact />;
        },
      };

    case "business-licences":
      return {
        title: "Edmonton Business Licences",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchEdmontonBusinessLicences();
          return <TimeSeriesAreaChart data={data} color="#8b5cf6" height={350} />;
        },
      };

    case "building-permits":
      return {
        title: "Edmonton Building Permits",
        source: "Edmonton Open Data",
        render: async () => {
          const data = await fetchEdmontonPermitsSummary();
          return <TimeSeriesAreaChart data={data} color="#f59e0b" height={350} />;
        },
      };

    // === Cycle page ===
    case "energy-vs-unemployment":
      return {
        title: "Energy Price vs Unemployment",
        source: "Bank of Canada / Statistics Canada",
        render: async () => {
          const [energy, unemployment] = await Promise.all([
            fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120),
            fetchStatCanTimeSeries(STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId, STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate, 60),
          ]);
          const merged = mergeTwoSeries(energy, unemployment, "energy", "unemployment");
          return (
            <MultiSeriesLineChart
              data={merged}
              series={[
                { key: "energy", label: "Energy Index", color: "#f97316", yAxisId: "left" },
                { key: "unemployment", label: "Unemployment %", color: "#ef4444", suffix: "%", yAxisId: "right" },
              ]}
              height={350}
              dualAxis
            />
          );
        },
      };

    case "energy-vs-housing":
      return {
        title: "Energy Price vs Housing Starts",
        source: "Bank of Canada / CMHC",
        render: async () => {
          const [energy, housing] = await Promise.all([
            fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120),
            fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId, STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate, 60),
          ]);
          const merged = mergeTwoSeries(energy, housing, "energy", "housing");
          return (
            <MultiSeriesLineChart
              data={merged}
              series={[
                { key: "energy", label: "Energy Index", color: "#f97316", yAxisId: "left" },
                { key: "housing", label: "Housing Starts", color: "#3b82f6", yAxisId: "right" },
              ]}
              height={350}
              dualAxis
            />
          );
        },
      };

    case "gdp":
      return {
        title: "Alberta Real GDP",
        source: "Statistics Canada 36-10-0402",
        render: async () => {
          const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP;
          const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
          return <TimeSeriesAreaChart data={data} color="#10b981" height={350} compact />;
        },
      };

    case "aax":
      return {
        title: "Alberta Activity Index (AAX)",
        source: "Alberta Open Data",
        render: async () => {
          const allData = await fetchAlbertaActivityIndex();
          const data = allData.slice(-240);
          return <TimeSeriesAreaChart data={data} color="#8b5cf6" height={350} />;
        },
      };

    default:
      return null;
  }
}

function resolveChart(chartId: string): ChartDef | null {
  // Macro charts: "macro-policy-rate", "macro-unemployment"
  if (chartId.startsWith("macro-")) {
    return macroChart(chartId.replace("macro-", ""));
  }

  // Municipality charts: "{slug}-{type}"
  // Find the longest matching slug
  const allSlugs = getLiveMunicipalities().map((m) => m.slug).sort((a, b) => b.length - a.length);
  for (const slug of allSlugs) {
    if (chartId.startsWith(`${slug}-`)) {
      const type = chartId.slice(slug.length + 1);
      return municipalityChart(slug, type);
    }
  }

  return null;
}

// ============================================================
// Page
// ============================================================

export async function generateMetadata({ params }: { params: Promise<{ chartId: string }> }) {
  const { chartId } = await params;
  const chart = resolveChart(chartId);
  return {
    title: chart?.title || "Chart — Alberta Pulse Check",
  };
}

export default async function EmbedPage({ params }: { params: Promise<{ chartId: string }> }) {
  const { chartId } = await params;
  const chart = resolveChart(chartId);
  if (!chart) notFound();

  const rendered = await chart.render();

  return (
    <div className="bg-card text-foreground p-4" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-foreground">{chart.title}</h2>
        <span className="text-[9px] font-mono bg-accent/10 text-accent px-2 py-0.5 rounded-full">
          LIVE
        </span>
      </div>

      {/* Chart */}
      {rendered}

      {/* Watermark */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-card-border">
        <span className="text-[9px] text-muted/60">{chart.source}</span>
        <a
          href="https://albertapulse.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] text-accent/60 hover:text-accent transition-colors"
        >
          Powered by Alberta Pulse Check
        </a>
      </div>
    </div>
  );
}
